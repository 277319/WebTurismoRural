from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.experiencia import Experiencia
    from app.models.usuario import Usuario


class Emprendimiento(Base):
    __tablename__ = "emprendimientos"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150))
    telefono_contacto: Mapped[str] = mapped_column(String(20))
    direccion: Mapped[str] = mapped_column(String(255))
    localidad: Mapped[str] = mapped_column(String(100), index=True)
    descripcion: Mapped[str | None] = mapped_column(Text)
    historia: Mapped[str | None] = mapped_column(Text)
    # {"instagram": "usuario", "facebook": "pagina", "tiktok": "usuario", "whatsapp": "+569...", "sitio_web": "https://..."}
    redes: Mapped[dict[str, str]] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    # Nombre del archivo dentro de UPLOADS_DIR/emprendimientos/
    foto_perfil: Mapped[str | None] = mapped_column(String(255))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="emprendimientos")
    experiencias: Mapped[list["Experiencia"]] = relationship(
        back_populates="emprendimiento", cascade="all, delete-orphan"
    )
