import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.disponibilidad_experiencia import DisponibilidadExperiencia
    from app.models.emprendimiento import Emprendimiento
    from app.models.foto_experiencia import FotoExperiencia


class TipoExperiencia(str, enum.Enum):
    senderismo = "senderismo"
    cabalgata = "cabalgata"
    gastronomia = "gastronomia"
    agroturismo = "agroturismo"
    artesania = "artesania"
    pesca = "pesca"
    acuatica = "acuatica"
    avistamiento = "avistamiento"
    cultural = "cultural"
    # Se reserva por noches: el precio es por persona y noche, y los cupos de cada día son camas libres esa noche
    hospedaje = "hospedaje"


class EstadoExperiencia(str, enum.Enum):
    activo = "activo"
    pausado = "pausado"


class Experiencia(Base):
    __tablename__ = "experiencias"
    __table_args__ = (
        CheckConstraint("precio_por_persona >= 0", name="ck_experiencias_precio"),
        CheckConstraint("capacidad_maxima > 0", name="ck_experiencias_capacidad"),
        CheckConstraint("(latitud IS NULL) = (longitud IS NULL)", name="ck_experiencias_coordenadas"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    emprendimiento_id: Mapped[int] = mapped_column(
        ForeignKey("emprendimientos.id", ondelete="CASCADE"), index=True
    )
    tipo: Mapped[TipoExperiencia] = mapped_column(Enum(TipoExperiencia, name="tipo_experiencia"), index=True)
    titulo: Mapped[str] = mapped_column(String(150))
    descripcion: Mapped[str] = mapped_column(Text)
    precio_por_persona: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    capacidad_maxima: Mapped[int] = mapped_column(Integer)
    localidad: Mapped[str] = mapped_column(String(100), index=True)
    latitud: Mapped[float | None] = mapped_column(Float)
    longitud: Mapped[float | None] = mapped_column(Float)
    estado: Mapped[EstadoExperiencia] = mapped_column(
        Enum(EstadoExperiencia, name="estado_experiencia"),
        default=EstadoExperiencia.activo,
        server_default=EstadoExperiencia.activo.value,
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    emprendimiento: Mapped["Emprendimiento"] = relationship(back_populates="experiencias")
    fotos: Mapped[list["FotoExperiencia"]] = relationship(
        back_populates="experiencia",
        cascade="all, delete-orphan",
        order_by="FotoExperiencia.orden",
    )
    disponibilidad: Mapped[list["DisponibilidadExperiencia"]] = relationship(
        back_populates="experiencia",
        cascade="all, delete-orphan",
        order_by="DisponibilidadExperiencia.fecha",
    )
