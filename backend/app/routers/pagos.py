import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.avisos_reserva import avisar_pagada
from app.core.db import get_db
from app.core.deps import get_usuario_actual
from app.models.pago import EstadoPago, Pago
from app.models.reserva import EstadoReserva, MetodoPago, Reserva
from app.models.usuario import Usuario
from app.pagos import obtener_proveedor
from app.pagos.base import ErrorProveedor, FirmaInvalida, Notificacion
from app.pagos.simulado import ProveedorSimulado
from app.schemas.pago import PagoCrear, PagoIniciado, PagoPublico, PagoSimulado

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagos", tags=["pagos"])

# Por qué una reserva no se puede pagar en línea, según su estado
NO_SE_PUEDE_PAGAR = {
    EstadoReserva.pendiente: "El anfitrión aún no confirma tu reserva. Podrás pagarla cuando la confirme",
    EstadoReserva.pagada: "Esta reserva ya está pagada",
    EstadoReserva.cancelada: "Esta reserva está cancelada",
    EstadoReserva.rechazada: "Esta reserva fue rechazada",
}


@router.post("", response_model=PagoIniciado, status_code=status.HTTP_201_CREATED)
def iniciar_pago(
    datos: PagoCrear,
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
) -> PagoIniciado:
    """
    El visitante empieza a pagar en línea una reserva confirmada: se crea el cobro en el proveedor
    y se devuelve la página a la que hay que enviarlo. La reserva pasa a pagada cuando llega el aviso
    del proveedor al webhook, no al volver el visitante.
    """
    reserva = db.get(Reserva, datos.reserva_id)
    if reserva is None or reserva.visitante_id != usuario.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada")
    if reserva.estado != EstadoReserva.confirmada:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=NO_SE_PUEDE_PAGAR[reserva.estado])
    if reserva.total == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Esta reserva es gratuita: no hay nada que pagar")

    proveedor = obtener_proveedor()
    pago = Pago(reserva_id=reserva.id, proveedor=proveedor.nombre, monto=reserva.total)
    db.add(pago)
    db.flush()  # para tener el id, que el proveedor usa como referencia
    try:
        cobro = proveedor.crear_cobro(pago, f"Reserva #{reserva.id}: {reserva.experiencia.titulo}")
    except ErrorProveedor:
        logger.exception("No se pudo crear el cobro de la reserva %s", reserva.id)
        db.rollback()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, detail="No pudimos conectar con el medio de pago. Inténtalo de nuevo"
        )
    pago.id_cobro = cobro.id_cobro
    db.commit()
    return PagoIniciado(id=pago.id, url_pago=cobro.url_pago)


def pago_del_visitante(pago_id: int, usuario: Usuario, db: Session) -> Pago:
    pago = db.get(Pago, pago_id)
    if pago is None or pago.reserva.visitante_id != usuario.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    return pago


@router.get("/{pago_id}", response_model=PagoPublico)
def obtener_pago(
    pago_id: int,
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
) -> Pago:
    """Estado de un pago propio, para las páginas de resultado (que lo consultan hasta que se resuelve)."""
    return pago_del_visitante(pago_id, usuario, db)


@router.post("/webhook")
async def webhook(request: Request, tareas: BackgroundTasks, db: Session = Depends(get_db)) -> dict[str, bool]:
    """
    Avisos del proveedor de pago. Si el pago se aprobó, la reserva pasa a pagada y se avisa al visitante.
    Responde 200 a todo aviso válido, aunque no cambie nada (el proveedor reintenta los que fallan):
    un mismo aviso puede llegar varias veces.
    """
    cuerpo = await request.body()
    proveedor = obtener_proveedor()
    try:
        # Mercado Pago consulta su API para leer el aviso: fuera del event loop
        notificacion = await run_in_threadpool(
            proveedor.leer_notificacion, cuerpo, request.headers, request.query_params
        )
    except FirmaInvalida:
        logger.warning("Aviso de pago con firma inválida desde %s", request.client.host if request.client else "?")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Firma inválida")
    except ErrorProveedor:
        logger.exception("No se pudo leer un aviso de pago")
        # 502: el proveedor lo reintentará más tarde
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="No se pudo consultar el pago")
    if notificacion is not None:
        await run_in_threadpool(registrar_notificacion, notificacion, proveedor.nombre, tareas, db)
    return {"ok": True}


def registrar_notificacion(n: Notificacion, proveedor: str, tareas: BackgroundTasks, db: Session) -> None:
    # Bloquea el pago: dos avisos simultáneos del mismo pago se atienden uno después del otro
    pago = db.get(Pago, n.pago_id, with_for_update=True)
    if pago is None or pago.proveedor != proveedor:
        logger.warning("Aviso de %s para un pago desconocido: %s", proveedor, n.pago_id)
        return
    if pago.estado != EstadoPago.pendiente or n.estado == EstadoPago.pendiente:
        # Ya resuelto (aviso repetido) o todavía sin resolver: nada que hacer
        return
    if n.monto != pago.monto:
        logger.error(
            "El pago %s se cobró por %s, pero debía ser %s: queda pendiente para revisarlo", pago.id, n.monto, pago.monto
        )
        return

    pago.estado = n.estado
    pago.id_transaccion = n.id_transaccion
    pagada = False
    if n.estado == EstadoPago.aprobado:
        # Solo si sigue confirmada: si se canceló mientras el visitante pagaba, no se reactiva
        pagada = (
            db.scalar(
                update(Reserva)
                .where(Reserva.id == pago.reserva_id, Reserva.estado == EstadoReserva.confirmada)
                .values(estado=EstadoReserva.pagada, metodo_pago=MetodoPago.en_linea)
                .returning(Reserva.id)
            )
            is not None
        )
        if not pagada:
            logger.error(
                "Pago %s aprobado, pero la reserva %s ya no estaba confirmada: hay que devolver el dinero",
                pago.id,
                pago.reserva_id,
            )
    db.commit()
    if pagada:
        db.refresh(pago.reserva)
        avisar_pagada(tareas, pago.reserva)


@router.post("/{pago_id}/simular", response_model=PagoPublico)
def simular_pago(
    pago_id: int,
    datos: PagoSimulado,
    tareas: BackgroundTasks,
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
) -> Pago:
    """
    Solo con la pasarela simulada: el visitante aprueba o rechaza su pago. El resultado llega después
    al webhook, como un aviso del proveedor; mientras, el pago sigue pendiente.
    """
    proveedor = obtener_proveedor()
    if not isinstance(proveedor, ProveedorSimulado):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    pago = pago_del_visitante(pago_id, usuario, db)
    if pago.proveedor != proveedor.nombre or pago.estado != EstadoPago.pendiente:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Este pago ya se procesó")
    estado = EstadoPago.aprobado if datos.aprobar else EstadoPago.rechazado
    tareas.add_task(proveedor.notificar, pago.id, estado, pago.monto)
    return pago
