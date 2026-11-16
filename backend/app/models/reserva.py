import enum
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.experiencia import Experiencia
    from app.models.usuario import Usuario


class EstadoReserva(str, enum.Enum):
    pendiente = "pendiente"
    confirmada = "confirmada"
    # El anfitrión registró el pago de una reserva confirmada
    pagada = "pagada"
    cancelada = "cancelada"
    # El anfitrión no aceptó la solicitud pendiente
    rechazada = "rechazada"


class MetodoPago(str, enum.Enum):
    efectivo = "efectivo"
    transferencia = "transferencia"
    tarjeta = "tarjeta"
    # Con tarjeta en la web, a través del proveedor de pagos, una vez confirmada la reserva
    en_linea = "en_linea"


# Las reservas que ocupan cupos (las canceladas y rechazadas los liberan)
ESTADOS_ACTIVOS = (EstadoReserva.pendiente, EstadoReserva.confirmada, EstadoReserva.pagada)

# Estadía más larga que se puede reservar de una vez en un hospedaje
MAX_NOCHES = 30


class Reserva(Base):
    __tablename__ = "reservas"
    __table_args__ = (
        CheckConstraint("personas > 0", name="ck_reservas_personas"),
        CheckConstraint("total >= 0", name="ck_reservas_total"),
        CheckConstraint("noches > 0", name="ck_reservas_noches"),
        # Para sumar las personas reservadas por día de una experiencia
        Index("ix_reservas_experiencia_fecha", "experiencia_id", "fecha"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    visitante_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    experiencia_id: Mapped[int] = mapped_column(ForeignKey("experiencias.id", ondelete="CASCADE"))
    # En un hospedaje, el día de llegada (la primera noche)
    fecha: Mapped[date] = mapped_column(Date)
    # Noches seguidas desde `fecha` que ocupa la reserva; siempre 1 salvo en los hospedajes
    noches: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    personas: Mapped[int] = mapped_column(Integer)
    # Precio vigente al reservar: si el anfitrión lo cambia después, la reserva mantiene el suyo.
    # En los hospedajes es por persona y noche
    precio_por_persona: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    estado: Mapped[EstadoReserva] = mapped_column(
        Enum(EstadoReserva, name="estado_reserva"),
        default=EstadoReserva.pendiente,
        server_default=EstadoReserva.pendiente.value,
    )
    # Sin método en las experiencias gratuitas
    metodo_pago: Mapped[MetodoPago | None] = mapped_column(Enum(MetodoPago, name="metodo_pago"))
    # Adónde se avisan los cambios de estado. Obligatorio al reservar (así también reciben avisos las
    # cuentas registradas solo con teléfono); nulo solo en reservas anteriores a este campo
    correo: Mapped[str | None] = mapped_column(String(255))
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def fecha_salida(self) -> date:
        """Día siguiente a la última noche (en las experiencias de un día, el siguiente a la fecha)."""
        return self.fecha + timedelta(days=self.noches)

    @property
    def dias(self) -> list[date]:
        """Días cuyos cupos ocupa: uno por noche."""
        return [self.fecha + timedelta(days=i) for i in range(self.noches)]

    visitante: Mapped["Usuario"] = relationship()
    experiencia: Mapped["Experiencia"] = relationship()
