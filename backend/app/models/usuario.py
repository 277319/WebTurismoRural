import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.emprendimiento import Emprendimiento


class RolUsuario(str, enum.Enum):
    visitante = "visitante"
    anfitrion = "anfitrion"
    admin = "admin"


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint(
            "correo IS NOT NULL OR telefono IS NOT NULL",
            name="ck_usuarios_correo_o_telefono",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str | None] = mapped_column(String(100))
    correo: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    telefono: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    contrasena_hash: Mapped[str] = mapped_column(String(255))
    rol: Mapped[RolUsuario] = mapped_column(
        Enum(RolUsuario, name="rol_usuario"),
        default=RolUsuario.visitante,
        server_default=RolUsuario.visitante.value,
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    emprendimientos: Mapped[list["Emprendimiento"]] = relationship(
        back_populates="usuario", cascade="all, delete-orphan"
    )
