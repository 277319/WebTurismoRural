from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.experiencia import Experiencia

# Hasta cuántos días hacia adelante el anfitrión puede abrir fechas
MAX_DIAS_DISPONIBILIDAD = 365


class DisponibilidadExperiencia(Base):
    """Un día en que la experiencia se ofrece, con los cupos que quedan libres ese día."""

    __tablename__ = "disponibilidad_experiencia"
    __table_args__ = (
        UniqueConstraint("experiencia_id", "fecha", name="uq_disponibilidad_experiencia_fecha"),
        # 0 = día agotado (cuando existan reservas); para cerrar un día se borra la fila
        CheckConstraint("cupos >= 0", name="ck_disponibilidad_experiencia_cupos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Sin índice propio: la restricción única (experiencia_id, fecha) ya sirve para buscar por experiencia
    experiencia_id: Mapped[int] = mapped_column(ForeignKey("experiencias.id", ondelete="CASCADE"))
    fecha: Mapped[date] = mapped_column(Date)
    cupos: Mapped[int] = mapped_column(Integer)

    experiencia: Mapped["Experiencia"] = relationship(back_populates="disponibilidad")
