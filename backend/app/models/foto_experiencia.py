from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.experiencia import Experiencia

# Máximo de fotos en la galería de una experiencia
MAX_FOTOS_EXPERIENCIA = 8


class FotoExperiencia(Base):
    __tablename__ = "fotos_experiencia"
    __table_args__ = (CheckConstraint("orden >= 0", name="ck_fotos_experiencia_orden"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    experiencia_id: Mapped[int] = mapped_column(ForeignKey("experiencias.id", ondelete="CASCADE"), index=True)
    # Ruta pública de la foto (p. ej. "/uploads/experiencias/abc123.webp")
    url: Mapped[str] = mapped_column(String(255))
    # Posición en la galería, desde 0; la primera es la foto principal de la experiencia
    orden: Mapped[int] = mapped_column(Integer)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    experiencia: Mapped["Experiencia"] = relationship(back_populates="fotos")
