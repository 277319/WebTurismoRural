from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.experiencia import Experiencia
    from app.models.usuario import Usuario

# Paleta "Bosque", la misma que usa el resto del sitio
COLOR_PRIMARIO_POR_DEFECTO = "#47702e"
COLOR_SECUNDARIO_POR_DEFECTO = "#a0673a"

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

    # --- Personalización de la página pública ---
    # Colores hexadecimales '#rrggbb', aplicados como variables CSS en la página pública
    color_primario: Mapped[str] = mapped_column(
        String(7), default=COLOR_PRIMARIO_POR_DEFECTO, server_default=COLOR_PRIMARIO_POR_DEFECTO
    )
    color_secundario: Mapped[str] = mapped_column(
        String(7), default=COLOR_SECUNDARIO_POR_DEFECTO, server_default=COLOR_SECUNDARIO_POR_DEFECTO
    )
    # Ruta pública de la foto de portada (p. ej. "/uploads/emprendimientos/abc123.jpg")
    portada_url: Mapped[str | None] = mapped_column(String(255))
    relato_comunidad: Mapped[str | None] = mapped_column(Text)
    # Bloques opcionales que el anfitrión activa o desactiva:
    # {"gastronomia": {"activo": true, "contenido": "..."}, "festividades": {...}, "normas_visita": {...}}
    bloques: Mapped[dict[str, dict]] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))

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
