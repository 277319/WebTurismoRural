from datetime import date, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, joinedload

from app.core.avisos_reserva import avisar_confirmada, avisar_nueva_solicitud, avisar_pagada, avisar_rechazada
from app.core.db import get_db
from app.core.deps import get_usuario_actual, requerir_rol
from app.core.fechas import hoy
from app.models.disponibilidad_experiencia import DisponibilidadExperiencia
from app.models.experiencia import EstadoExperiencia, Experiencia, TipoExperiencia
from app.models.reserva import ESTADOS_ACTIVOS, EstadoReserva, Reserva
from app.models.usuario import RolUsuario, Usuario
from app.schemas.reserva import ReservaCrear, ReservaPublica

router = APIRouter(prefix="/reservas", tags=["reservas"])

solo_anfitrion = requerir_rol(RolUsuario.anfitrion)


def error(codigo: int, campo: str, mensaje: str) -> HTTPException:
    return HTTPException(codigo, detail={"campo": campo, "mensaje": mensaje})


@router.post("", response_model=ReservaPublica, status_code=status.HTTP_201_CREATED)
def crear_reserva(
    datos: ReservaCrear,
    tareas: BackgroundTasks,
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
) -> Reserva:
    """
    Reserva una fecha disponible (o, en un hospedaje, varias noches seguidas) y descuenta sus cupos
    en la misma transacción. El total se calcula aquí con el precio vigente; queda pendiente de
    confirmación del anfitrión.
    Avisa por correo al visitante y al anfitrión.
    """
    # FOR SHARE: varias reservas pueden avanzar a la vez, pero el anfitrión no puede cambiar
    # la capacidad ni la disponibilidad hasta que esta termine (y viceversa)
    if not usuario.nombre:
        # Cuentas creadas antes de que el nombre fuera obligatorio (y anfitriones, que pueden no tenerlo)
        raise error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "nombre",
            "Agrega tu nombre en Mi cuenta para reservar: el anfitrión necesita saber quién lo visita",
        )
    experiencia = db.get(Experiencia, datos.experiencia_id, with_for_update={"read": True})
    if experiencia is None or experiencia.estado != EstadoExperiencia.activo:
        raise error(status.HTTP_404_NOT_FOUND, "experiencia_id", "Esta experiencia no está disponible para reservar")
    if experiencia.emprendimiento.usuario_id == usuario.id:
        raise error(status.HTTP_403_FORBIDDEN, "experiencia_id", "No puedes reservar tu propia experiencia")
    hospedaje = experiencia.tipo == TipoExperiencia.hospedaje
    if datos.noches > 1 and not hospedaje:
        raise error(status.HTTP_422_UNPROCESSABLE_ENTITY, "noches", "Esta experiencia se reserva por un solo día")
    if datos.personas > experiencia.capacidad_maxima:
        raise error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "personas",
            f"{'Este hospedaje' if hospedaje else 'Esta experiencia'} admite hasta {experiencia.capacidad_maxima} "
            f"personas por {'noche' if hospedaje else 'salida'}",
        )
    if datos.fecha < hoy():
        raise error(status.HTTP_422_UNPROCESSABLE_ENTITY, "fecha", "Esa fecha ya pasó. Elige otra")
    gratuita = experiencia.precio_por_persona == 0
    if not gratuita and datos.metodo_pago is None:
        raise error(status.HTTP_422_UNPROCESSABLE_ENTITY, "metodo_pago", "Elige cómo vas a pagar")

    noches = [datos.fecha + timedelta(days=i) for i in range(datos.noches)]
    # Descuenta los cupos de todas las noches en una sola sentencia y solo donde alcanzan: dos reservas
    # simultáneas no pueden quedarse con los mismos cupos, porque la segunda ya ve el valor descontado
    descontadas = db.scalars(
        update(DisponibilidadExperiencia)
        .where(
            DisponibilidadExperiencia.experiencia_id == experiencia.id,
            DisponibilidadExperiencia.fecha.in_(noches),
            DisponibilidadExperiencia.cupos >= datos.personas,
        )
        .values(cupos=DisponibilidadExperiencia.cupos - datos.personas)
        .returning(DisponibilidadExperiencia.fecha)
    ).all()
    if len(descontadas) < len(noches):
        # Alguna noche no alcanzó: se deshacen las que sí se descontaron
        db.rollback()
        raise sin_cupos(datos, noches, hospedaje, db)

    reserva = Reserva(
        visitante_id=usuario.id,
        experiencia_id=experiencia.id,
        fecha=datos.fecha,
        noches=datos.noches,
        personas=datos.personas,
        precio_por_persona=experiencia.precio_por_persona,
        total=experiencia.precio_por_persona * datos.personas * datos.noches,
        estado=EstadoReserva.pendiente,
        metodo_pago=None if gratuita else datos.metodo_pago,
        correo=datos.correo,
    )
    db.add(reserva)
    db.commit()
    db.refresh(reserva)
    avisar_nueva_solicitud(tareas, reserva)
    return reserva


def sin_cupos(datos: ReservaCrear, noches: list[date], hospedaje: bool, db: Session) -> HTTPException:
    """Explica por qué no alcanzaron los cupos: un día cerrado o agotado, o menos cupos que personas."""
    cupos = dict(
        db.execute(
            select(DisponibilidadExperiencia.fecha, DisponibilidadExperiencia.cupos).where(
                DisponibilidadExperiencia.experiencia_id == datos.experiencia_id,
                DisponibilidadExperiencia.fecha.in_(noches),
            )
        ).all()
    )
    sin_lugar = next((noche for noche in noches if not cupos.get(noche)), None)
    if sin_lugar is not None:
        mensaje = (
            f"La noche del {sin_lugar.strftime('%d-%m-%Y')} no está disponible. Elige otras fechas"
            if hospedaje
            else "Esta fecha ya no tiene cupos disponibles. Elige otra"
        )
        return error(status.HTTP_409_CONFLICT, "fecha", mensaje)
    libres = min(cupos[noche] for noche in noches)
    quedan = "queda 1 cupo" if libres == 1 else f"quedan {libres} cupos"
    return error(
        status.HTTP_409_CONFLICT,
        "personas",
        f"Solo {quedan} para {'esas noches' if len(noches) > 1 else 'esta fecha'}",
    )


@router.get("/mias", response_model=list[ReservaPublica])
def mis_reservas(
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
) -> list[Reserva]:
    """Reservas hechas por el usuario, de la fecha más lejana a la más antigua."""
    consulta = (
        select(Reserva)
        .where(Reserva.visitante_id == usuario.id)
        .options(joinedload(Reserva.experiencia).joinedload(Experiencia.emprendimiento))
        .order_by(Reserva.fecha.desc(), Reserva.id.desc())
    )
    return list(db.scalars(consulta))


def obtener_reserva(reserva_id: int, db: Session) -> Reserva:
    reserva = db.get(Reserva, reserva_id)
    if reserva is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada")
    return reserva


def es_anfitrion_de(reserva: Reserva, usuario: Usuario) -> bool:
    return reserva.experiencia.emprendimiento.usuario_id == usuario.id


# Por qué no se pudo cambiar una reserva, según el estado en que quedó
MENSAJE_POR_ESTADO = {
    EstadoReserva.pendiente: "Esta reserva aún no está confirmada",
    EstadoReserva.confirmada: "Esta reserva ya estaba confirmada",
    EstadoReserva.pagada: "Esta reserva ya está pagada",
    EstadoReserva.cancelada: "Esta reserva ya estaba cancelada",
    EstadoReserva.rechazada: "Esta reserva fue rechazada",
}


def cambiar_estado(
    reserva: Reserva, desde: tuple[EstadoReserva, ...], hacia: EstadoReserva, db: Session, liberar_cupos: bool = False
) -> None:
    """
    Pasa la reserva a `hacia` solo si sigue en uno de los estados `desde`, en la misma sentencia:
    si llegan dos cambios a la vez (p. ej. el visitante cancela mientras el anfitrión confirma), el segundo falla
    con 409 en vez de pisar al primero. Con `liberar_cupos`, devuelve sus personas a los cupos de cada día
    (de cada noche, en un hospedaje).
    No hace commit.
    """
    if liberar_cupos:
        # Bloqueo compartido de la experiencia, igual que al reservar: el anfitrión no puede estar
        # cambiando capacidad o disponibilidad mientras se devuelven los cupos
        db.execute(select(Experiencia.id).where(Experiencia.id == reserva.experiencia_id).with_for_update(read=True))
    cambiada = db.scalar(
        update(Reserva)
        .where(Reserva.id == reserva.id, Reserva.estado.in_(desde))
        .values(estado=hacia)
        .returning(Reserva.id)
    )
    if cambiada is None:
        db.refresh(reserva)
        raise HTTPException(status.HTTP_409_CONFLICT, detail=MENSAJE_POR_ESTADO[reserva.estado])
    if liberar_cupos:
        db.execute(
            update(DisponibilidadExperiencia)
            .where(
                DisponibilidadExperiencia.experiencia_id == reserva.experiencia_id,
                DisponibilidadExperiencia.fecha.in_(reserva.dias),
            )
            .values(cupos=DisponibilidadExperiencia.cupos + reserva.personas)
        )


def reserva_del_anfitrion(reserva_id: int, usuario: Usuario, db: Session) -> Reserva:
    reserva = obtener_reserva(reserva_id, db)
    if not es_anfitrion_de(reserva, usuario):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada")
    return reserva


@router.patch("/{reserva_id}/cancelar", response_model=ReservaPublica)
def cancelar_reserva(
    reserva_id: int,
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
) -> Reserva:
    """
    Cancela una reserva activa (pendiente, confirmada o pagada) y devuelve sus cupos al día.
    Puede hacerlo el visitante que reservó o el anfitrión de la experiencia.
    """
    reserva = obtener_reserva(reserva_id, db)
    if reserva.visitante_id != usuario.id and not es_anfitrion_de(reserva, usuario):
        # Igual que si no existiera, para no revelar reservas ajenas
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada")
    if reserva.fecha < hoy():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="No se puede cancelar una reserva de una fecha que ya pasó")
    cambiar_estado(reserva, ESTADOS_ACTIVOS, EstadoReserva.cancelada, db, liberar_cupos=True)
    db.commit()
    db.refresh(reserva)
    return reserva


@router.patch("/{reserva_id}/confirmar", response_model=ReservaPublica)
def confirmar_reserva(
    reserva_id: int,
    tareas: BackgroundTasks,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Reserva:
    """El anfitrión confirma una reserva pendiente de su experiencia. Se avisa al visitante por correo."""
    reserva = reserva_del_anfitrion(reserva_id, usuario, db)
    cambiar_estado(reserva, (EstadoReserva.pendiente,), EstadoReserva.confirmada, db)
    db.commit()
    db.refresh(reserva)
    avisar_confirmada(tareas, reserva)
    return reserva


@router.patch("/{reserva_id}/rechazar", response_model=ReservaPublica)
def rechazar_reserva(
    reserva_id: int,
    tareas: BackgroundTasks,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Reserva:
    """
    El anfitrión rechaza una solicitud pendiente: sus cupos vuelven a quedar libres
    y se avisa al visitante por correo. Las ya confirmadas se cancelan, no se rechazan.
    """
    reserva = reserva_del_anfitrion(reserva_id, usuario, db)
    cambiar_estado(reserva, (EstadoReserva.pendiente,), EstadoReserva.rechazada, db, liberar_cupos=True)
    db.commit()
    db.refresh(reserva)
    avisar_rechazada(tareas, reserva)
    return reserva


@router.patch("/{reserva_id}/marcar-pagada", response_model=ReservaPublica)
def marcar_reserva_pagada(
    reserva_id: int,
    tareas: BackgroundTasks,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Reserva:
    """
    El anfitrión registra que recibió el pago de una reserva confirmada (también después de la fecha,
    para quien paga al llegar). Se avisa al visitante por correo, que le sirve de comprobante.
    """
    reserva = reserva_del_anfitrion(reserva_id, usuario, db)
    if reserva.total == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Esta reserva es gratuita: no hay pago que registrar")
    cambiar_estado(reserva, (EstadoReserva.confirmada,), EstadoReserva.pagada, db)
    db.commit()
    db.refresh(reserva)
    avisar_pagada(tareas, reserva)
    return reserva
