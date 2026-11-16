import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.reserva import Reserva


class EstadoPago(str, enum.Enum):
    # Cobro creado: el visitante está (o estuvo) en la página del proveedor
    pendiente = "pendiente"
    aprobado = "aprobado"
    rechazado = "rechazado"


class Pago(Base):
    """Un intento de pagar en línea una reserva. Cada vez que el visitante pulsa «Pagar» se crea uno nuevo."""

    __tablename__ = "pagos"
    __table_args__ = (CheckConstraint("monto > 0", name="ck_pagos_monto"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    reserva_id: Mapped[int] = mapped_column(ForeignKey("reservas.id", ondelete="CASCADE"), index=True)
    # Nombre del proveedor que creó el cobro ("simulado", "mercadopago"): sus avisos solo valen para sus pagos
    proveedor: Mapped[str] = mapped_column(String(30))
    # Total de la reserva al crear el cobro; el aviso del proveedor tiene que coincidir
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    estado: Mapped[EstadoPago] = mapped_column(
        Enum(EstadoPago, name="estado_pago"),
        default=EstadoPago.pendiente,
        server_default=EstadoPago.pendiente.value,
    )
    # Id del cobro en el proveedor (en Mercado Pago, la preferencia)
    id_cobro: Mapped[str | None] = mapped_column(String(100))
    # Id de la transacción que lo resolvió (en Mercado Pago, el pago), para buscarla en su panel
    id_transaccion: Mapped[str | None] = mapped_column(String(100))
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    reserva: Mapped["Reserva"] = relationship()
