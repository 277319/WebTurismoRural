import math
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import String, delete, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.archivos import borrar_foto_experiencia, comprimir_imagen, guardar_foto_experiencia, leer_imagen
from app.core.config import settings
from app.core.db import get_db
from app.core.deps import get_usuario_opcional, requerir_rol
from app.core.fechas import hoy
from app.models.disponibilidad_experiencia import MAX_DIAS_DISPONIBILIDAD, DisponibilidadExperiencia
from app.models.emprendimiento import Emprendimiento
from app.models.experiencia import EstadoExperiencia, Experiencia, TipoExperiencia
from app.models.foto_experiencia import MAX_FOTOS_EXPERIENCIA, FotoExperiencia
from app.models.reserva import ESTADOS_ACTIVOS, EstadoReserva, Reserva
from app.models.usuario import RolUsuario, Usuario
from app.schemas.experiencia import (
    DiaDisponible,
    DisponibilidadEditar,
    ExperienciaCrear,
    ExperienciaDetalle,
    ExperienciaEditar,
    ExperienciaEstado,
    ExperienciaPropia,
    ExperienciaPublica,
    FotoExperienciaPublica,
    OrdenFotos,
    PaginaExperiencias,
)
from app.schemas.reserva import ReservaAnfitrion

router = APIRouter(prefix="/experiencias", tags=["experiencias"])

solo_anfitrion = requerir_rol(RolUsuario.anfitrion)

# Para buscar localidades sin distinguir tildes: "pucon" encuentra "Pucón"
CON_TILDE = "áéíóúüàèìòù"
SIN_TILDE = "aeiouuaeiou"
QUITAR_TILDES = str.maketrans(CON_TILDE, SIN_TILDE)


def normalizar_localidad(columna):
    """Versión en minúsculas y sin tildes de la columna, calculada por PostgreSQL."""
    return func.translate(func.lower(columna), CON_TILDE, SIN_TILDE, type_=String)


def obtener_propia(experiencia_id: int, usuario: Usuario, db: Session) -> Experiencia:
    """Devuelve la experiencia si existe y pertenece a un emprendimiento del usuario; si no, 404 o 403."""
    experiencia = db.get(Experiencia, experiencia_id)
    if experiencia is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Experiencia no encontrada")
    if experiencia.emprendimiento.usuario_id != usuario.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Solo el dueño puede modificar esta experiencia")
    return experiencia


def obtener_visible(experiencia_id: int, usuario: Usuario | None, db: Session, options=()) -> Experiencia:
    """Experiencia activa, o pausada si quien consulta es su dueño; si no, 404."""
    experiencia = db.get(Experiencia, experiencia_id, options=list(options))
    es_dueno = experiencia is not None and usuario is not None and experiencia.emprendimiento.usuario_id == usuario.id
    if experiencia is None or (experiencia.estado != EstadoExperiencia.activo and not es_dueno):
        # Una pausada responde igual que una inexistente, para no revelar que existe
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Experiencia no encontrada")
    return experiencia


def verificar_emprendimiento_propio(emprendimiento_id: int, usuario: Usuario, db: Session) -> None:
    """403 si el emprendimiento no existe o no es del usuario (no se distingue, para no revelar cuáles existen)."""
    emprendimiento = db.get(Emprendimiento, emprendimiento_id)
    if emprendimiento is None or emprendimiento.usuario_id != usuario.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"campo": "emprendimiento_id", "mensaje": "Solo puedes publicar experiencias en tus emprendimientos"},
        )


@router.get("", response_model=PaginaExperiencias)
def catalogo(
    pagina: int = Query(1, ge=1, description="Número de página, desde 1"),
    por_pagina: int = Query(12, ge=1, le=50, description="Resultados por página (máx. 50)"),
    localidad: str | None = Query(
        None, max_length=100, description="Parte del nombre de la localidad; no distingue mayúsculas ni tildes"
    ),
    tipo: list[TipoExperiencia] | None = Query(
        None, description="Uno o más tipos; se repite el parámetro: ?tipo=pesca&tipo=senderismo"
    ),
    precio_min: Decimal | None = Query(None, ge=0, description="Precio por persona mínimo"),
    precio_max: Decimal | None = Query(None, ge=0, description="Precio por persona máximo (0 = solo gratuitas)"),
    db: Session = Depends(get_db),
) -> PaginaExperiencias:
    """Público: experiencias activas que cumplen los filtros, de la más reciente a la más antigua."""
    if precio_min is not None and precio_max is not None and precio_min > precio_max:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"campo": "precio_max", "mensaje": "El precio máximo debe ser mayor o igual al mínimo"},
        )

    filtros = [Experiencia.estado == EstadoExperiencia.activo]
    if localidad and localidad.strip():
        buscado = " ".join(localidad.split()).lower().translate(QUITAR_TILDES)
        filtros.append(normalizar_localidad(Experiencia.localidad).contains(buscado, autoescape=True))
    if tipo:
        filtros.append(Experiencia.tipo.in_(tipo))
    if precio_min is not None:
        filtros.append(Experiencia.precio_por_persona >= precio_min)
    if precio_max is not None:
        filtros.append(Experiencia.precio_por_persona <= precio_max)

    total = db.scalar(select(func.count()).select_from(Experiencia).where(*filtros)) or 0
    consulta = (
        select(Experiencia)
        .where(*filtros)
        .options(joinedload(Experiencia.emprendimiento), selectinload(Experiencia.fotos))
        .order_by(Experiencia.fecha_creacion.desc(), Experiencia.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
    )
    return PaginaExperiencias(
        items=[ExperienciaPublica.model_validate(e) for e in db.scalars(consulta)],
        total=total,
        pagina=pagina,
        por_pagina=por_pagina,
        paginas=math.ceil(total / por_pagina),
    )


@router.get("/localidades", response_model=list[str])
def localidades_catalogo(db: Session = Depends(get_db)) -> list[str]:
    """Público: localidades con experiencias activas, para sugerirlas en el filtro del catálogo."""
    consulta = (
        select(Experiencia.localidad)
        .where(Experiencia.estado == EstadoExperiencia.activo)
        .distinct()
        .order_by(Experiencia.localidad)
    )
    return list(db.scalars(consulta))


@router.post("", response_model=ExperienciaPublica, status_code=status.HTTP_201_CREATED)
def crear_experiencia(
    datos: ExperienciaCrear,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Experiencia:
    verificar_emprendimiento_propio(datos.emprendimiento_id, usuario, db)
    experiencia = Experiencia(**datos.model_dump())
    db.add(experiencia)
    db.commit()
    db.refresh(experiencia)
    return experiencia


@router.get("/mias", response_model=list[ExperienciaPropia])
def mis_experiencias(
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> list[ExperienciaPropia]:
    consulta = (
        select(Experiencia)
        .join(Experiencia.emprendimiento)
        .where(Emprendimiento.usuario_id == usuario.id)
        .options(joinedload(Experiencia.emprendimiento), selectinload(Experiencia.fotos))
        .order_by(Experiencia.fecha_creacion.desc())
    )
    experiencias = list(db.scalars(consulta))
    pendientes = dict(
        db.execute(
            select(Reserva.experiencia_id, func.count())
            .where(
                Reserva.experiencia_id.in_([e.id for e in experiencias]),
                Reserva.estado == EstadoReserva.pendiente,
                Reserva.fecha >= hoy(),
            )
            .group_by(Reserva.experiencia_id)
        ).all()
    )
    return [
        ExperienciaPropia.model_validate(e).model_copy(update={"reservas_pendientes": pendientes.get(e.id, 0)})
        for e in experiencias
    ]


@router.get("/{experiencia_id}", response_model=ExperienciaDetalle)
def obtener_experiencia(
    experiencia_id: int,
    usuario: Usuario | None = Depends(get_usuario_opcional),
    db: Session = Depends(get_db),
) -> Experiencia:
    """Público: detalle de una experiencia activa. Las pausadas solo las ve su dueño (para revisarlas)."""
    return obtener_visible(
        experiencia_id, usuario, db, options=[joinedload(Experiencia.emprendimiento), selectinload(Experiencia.fotos)]
    )


@router.put("/{experiencia_id}", response_model=ExperienciaPublica)
def editar_experiencia(
    experiencia_id: int,
    datos: ExperienciaEditar,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Experiencia:
    """Reemplaza todos los datos de la experiencia. Puede moverse a otro emprendimiento del mismo dueño."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    if datos.emprendimiento_id != experiencia.emprendimiento_id:
        verificar_emprendimiento_propio(datos.emprendimiento_id, usuario, db)
    # Espera a las reservas en curso, para recortar los cupos con las personas ya reservadas al día
    bloquear_experiencia(experiencia.id, db)
    for campo, valor in datos.model_dump().items():
        setattr(experiencia, campo, valor)
    # Si bajó la capacidad, ningún día futuro puede ofrecer más cupos de los que quedan libres con ella.
    # Las reservas ya hechas se respetan aunque superen la nueva capacidad
    reservados = reservados_por_fecha(experiencia.id, db)
    for dia in disponibilidad_futura(experiencia.id, db):
        dia.cupos = min(dia.cupos, max(datos.capacidad_maxima - reservados.get(dia.fecha, 0), 0))
    db.commit()
    db.refresh(experiencia)
    return experiencia


@router.patch("/{experiencia_id}/estado", response_model=ExperienciaPublica)
def cambiar_estado_experiencia(
    experiencia_id: int,
    datos: ExperienciaEstado,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Experiencia:
    """Pausa o reanuda la experiencia. Las pausadas no aparecen en el catálogo público."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    experiencia.estado = datos.estado
    db.commit()
    db.refresh(experiencia)
    return experiencia


@router.delete("/{experiencia_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_experiencia(
    experiencia_id: int,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> None:
    """Borra la experiencia junto con su galería (filas y archivos). No se puede deshacer."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    urls = [f.url for f in experiencia.fotos]
    db.delete(experiencia)
    db.commit()
    # Los archivos se borran después del commit: si este falla, las fotos siguen intactas
    for url in urls:
        borrar_foto_experiencia(url)


@router.get("/{experiencia_id}/reservas", response_model=list[ReservaAnfitrion])
def reservas_de_experiencia(
    experiencia_id: int,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> list[Reserva]:
    """Todas las reservas de la experiencia, con el contacto de cada visitante, por fecha."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    consulta = (
        select(Reserva)
        .where(Reserva.experiencia_id == experiencia.id)
        .options(joinedload(Reserva.visitante), joinedload(Reserva.experiencia).joinedload(Experiencia.emprendimiento))
        .order_by(Reserva.fecha, Reserva.id)
    )
    return list(db.scalars(consulta))


def bloquear_experiencia(experiencia_id: int, db: Session) -> int:
    """
    Bloquea la fila de la experiencia hasta el commit y devuelve su capacidad actual.
    Las reservas toman un bloqueo compartido de la misma fila, así que esperan a que el anfitrión
    termine de cambiar capacidad o disponibilidad (y viceversa).
    """
    return db.scalar(select(Experiencia.capacidad_maxima).where(Experiencia.id == experiencia_id).with_for_update())


def disponibilidad_futura(experiencia_id: int, db: Session) -> list[DisponibilidadExperiencia]:
    consulta = (
        select(DisponibilidadExperiencia)
        .where(DisponibilidadExperiencia.experiencia_id == experiencia_id, DisponibilidadExperiencia.fecha >= hoy())
        .order_by(DisponibilidadExperiencia.fecha)
    )
    return list(db.scalars(consulta))


def reservados_por_fecha(experiencia_id: int, db: Session) -> dict[date, int]:
    """
    Personas con reserva activa (pendiente, confirmada o pagada) en cada día desde hoy.
    Una estadía en un hospedaje cuenta en cada una de sus noches.
    """
    desde = hoy()
    consulta = select(Reserva).where(
        Reserva.experiencia_id == experiencia_id,
        # Las que tienen alguna noche desde hoy (la última noche es fecha + noches - 1)
        Reserva.fecha + Reserva.noches > desde,
        Reserva.estado.in_(ESTADOS_ACTIVOS),
    )
    reservados: dict[date, int] = defaultdict(int)
    for reserva in db.scalars(consulta):
        for dia in reserva.dias:
            if dia >= desde:
                reservados[dia] += reserva.personas
    return dict(reservados)


def dias_disponibles(experiencia_id: int, db: Session) -> list[DiaDisponible]:
    reservados = reservados_por_fecha(experiencia_id, db)
    return [
        DiaDisponible(fecha=d.fecha, cupos=d.cupos, reservados=reservados.get(d.fecha, 0))
        for d in disponibilidad_futura(experiencia_id, db)
    ]


def formato_fecha(fecha: date) -> str:
    return fecha.strftime("%d-%m-%Y")


@router.get("/{experiencia_id}/disponibilidad", response_model=list[DiaDisponible])
def obtener_disponibilidad(
    experiencia_id: int,
    usuario: Usuario | None = Depends(get_usuario_opcional),
    db: Session = Depends(get_db),
) -> list[DiaDisponible]:
    """Público: días abiertos desde hoy, con sus cupos libres. Mismas reglas de visibilidad que el detalle."""
    obtener_visible(experiencia_id, usuario, db)
    return dias_disponibles(experiencia_id, db)


@router.put("/{experiencia_id}/disponibilidad", response_model=list[DiaDisponible])
def guardar_disponibilidad(
    experiencia_id: int,
    datos: DisponibilidadEditar,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> list[DiaDisponible]:
    """
    Reemplaza los días abiertos desde hoy: los enviados quedan abiertos con sus cupos libres y el resto se cierra.
    Los días pasados no se tocan. Un día con reservas no se puede cerrar, y sus cupos libres más las personas
    ya reservadas no pueden superar la capacidad.
    """
    experiencia = obtener_propia(experiencia_id, usuario, db)
    capacidad = bloquear_experiencia(experiencia.id, db)
    reservados = reservados_por_fecha(experiencia.id, db)
    desde = hoy()
    hasta = desde + timedelta(days=MAX_DIAS_DISPONIBILIDAD)
    for i, dia in enumerate(datos.dias):
        if not desde <= dia.fecha <= hasta:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "campo": f"dias.{i}.fecha",
                    "mensaje": f"Solo puedes abrir días entre hoy y {MAX_DIAS_DISPONIBILIDAD} días más adelante",
                },
            )
        ocupados = reservados.get(dia.fecha, 0)
        if dia.cupos + ocupados > capacidad:
            mensaje = (
                f"El {formato_fecha(dia.fecha)} ya tiene {ocupados} personas reservadas: "
                f"puedes ofrecer como máximo {max(capacidad - ocupados, 0)} cupos más"
                if ocupados
                else f"Los cupos no pueden superar la capacidad máxima ({capacidad})"
            )
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"campo": f"dias.{i}.cupos", "mensaje": mensaje}
            )

    actuales = {d.fecha: d for d in disponibilidad_futura(experiencia.id, db)}
    nuevas = {d.fecha: d.cupos for d in datos.dias}

    cerradas = [fecha for fecha in actuales if fecha not in nuevas]
    con_reservas = [fecha for fecha in cerradas if reservados.get(fecha)]
    if con_reservas:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "campo": "dias",
                "mensaje": f"No puedes cerrar el {formato_fecha(con_reservas[0])} porque tiene reservas",
            },
        )
    if cerradas:
        db.execute(
            delete(DisponibilidadExperiencia).where(
                DisponibilidadExperiencia.experiencia_id == experiencia.id,
                DisponibilidadExperiencia.fecha.in_(cerradas),
            )
        )
    for fecha, cupos in nuevas.items():
        if fecha in actuales:
            actuales[fecha].cupos = cupos
        else:
            db.add(DisponibilidadExperiencia(experiencia_id=experiencia.id, fecha=fecha, cupos=cupos))
    db.commit()
    return dias_disponibles(experiencia.id, db)


@router.post(
    "/{experiencia_id}/fotos",
    response_model=FotoExperienciaPublica,
    status_code=status.HTTP_201_CREATED,
)
async def subir_foto_experiencia(
    experiencia_id: int,
    foto: UploadFile = File(description="JPG, PNG o WebP"),
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> FotoExperiencia:
    """Agrega una foto al final de la galería. Se redimensiona y comprime a WebP antes de guardarla."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    contenido, _ = await leer_imagen(foto, campo="foto", max_mb=settings.MAX_FOTO_EXPERIENCIA_MB)
    # Pillow es trabajo de CPU: fuera del event loop para no frenar otras peticiones
    comprimida = await run_in_threadpool(comprimir_imagen, contenido)
    if comprimida is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"campo": "foto", "mensaje": "No pudimos leer la imagen. Prueba con otro archivo JPG, PNG o WebP"},
        )

    # Bloquea la experiencia hasta el commit para que dos subidas simultáneas no superen el límite
    db.execute(select(Experiencia.id).where(Experiencia.id == experiencia.id).with_for_update())
    total, siguiente = db.execute(
        select(func.count(), func.coalesce(func.max(FotoExperiencia.orden) + 1, 0)).where(
            FotoExperiencia.experiencia_id == experiencia.id
        )
    ).one()
    if total >= MAX_FOTOS_EXPERIENCIA:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "campo": "foto",
                "mensaje": f"La galería admite hasta {MAX_FOTOS_EXPERIENCIA} fotos. Elimina alguna para agregar otra",
            },
        )

    url = guardar_foto_experiencia(comprimida)
    nueva = FotoExperiencia(experiencia_id=experiencia.id, url=url, orden=siguiente)
    db.add(nueva)
    try:
        db.commit()
    except Exception:
        borrar_foto_experiencia(url)
        raise
    db.refresh(nueva)
    return nueva


@router.put("/{experiencia_id}/fotos/orden", response_model=list[FotoExperienciaPublica])
def reordenar_fotos_experiencia(
    experiencia_id: int,
    datos: OrdenFotos,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> list[FotoExperiencia]:
    """Recibe los ids de todas las fotos en el nuevo orden; la primera pasa a ser la foto principal."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    fotos = {f.id: f for f in experiencia.fotos}
    if len(datos.ids) != len(fotos) or set(datos.ids) != fotos.keys():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="La galería cambió mientras la editabas. Recarga la página e inténtalo de nuevo",
        )
    for posicion, foto_id in enumerate(datos.ids):
        fotos[foto_id].orden = posicion
    db.commit()
    return experiencia.fotos


@router.delete("/{experiencia_id}/fotos/{foto_id}", response_model=list[FotoExperienciaPublica])
def eliminar_foto_experiencia(
    experiencia_id: int,
    foto_id: int,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> list[FotoExperiencia]:
    """Quita la foto de la galería y del disco; devuelve las fotos que quedan, renumeradas desde 0."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    foto = next((f for f in experiencia.fotos if f.id == foto_id), None)
    if foto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")

    url = foto.url
    experiencia.fotos.remove(foto)  # delete-orphan: se borra la fila
    for posicion, restante in enumerate(experiencia.fotos):
        restante.orden = posicion
    db.commit()
    borrar_foto_experiencia(url)
    return experiencia.fotos
