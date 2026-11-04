import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.usuario import RolUsuario
from app.schemas.emprendimiento import EmprendimientoCrear
from app.schemas.validadores import Telefono


class UsuarioRegistro(BaseModel):
    correo: EmailStr | None = None
    telefono: Telefono | None = None
    contrasena: str = Field(min_length=8, max_length=72)
    # Solo se permite registrarse como visitante o anfitrión (nunca como admin)
    rol: Literal["visitante", "anfitrion"] = "visitante"
    emprendimiento: EmprendimientoCrear | None = None

    @field_validator("correo")
    @classmethod
    def normalizar_correo(cls, v: str | None) -> str | None:
        return v.strip().lower() if v else None

    @field_validator("contrasena")
    @classmethod
    def validar_contrasena(cls, v: str) -> str:
        if len(v.encode()) > 72:
            raise ValueError("La contraseña es demasiado larga")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("La contraseña debe contener letras y números")
        return v

    @model_validator(mode="after")
    def correo_o_telefono(self) -> "UsuarioRegistro":
        if not self.correo and not self.telefono:
            raise ValueError("Debes indicar un correo o un teléfono")
        if self.rol == RolUsuario.anfitrion and self.emprendimiento is None:
            raise ValueError("Los anfitriones deben registrar los datos de su emprendimiento")
        if self.rol == RolUsuario.visitante and self.emprendimiento is not None:
            raise ValueError("Solo los anfitriones pueden registrar un emprendimiento")
        return self


class UsuarioPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str | None
    correo: str | None
    telefono: str | None
    rol: RolUsuario
    fecha_creacion: datetime


class UsuarioLogin(BaseModel):
    identificador: str = Field(min_length=1, description="Correo o teléfono")
    contrasena: str = Field(min_length=1)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioPublico


class UsuarioActualizar(BaseModel):
    """PUT /usuarios/me: reemplaza los datos personales. Enviar null (o "") borra el dato."""

    nombre: str | None = Field(max_length=100)
    correo: EmailStr | None
    telefono: Telefono | None
    # Obligatoria solo si cambia el correo o el teléfono (los datos con los que se inicia sesión)
    contrasena_actual: str | None = None

    @field_validator("nombre", "correo", "telefono", mode="before")
    @classmethod
    def vacio_a_none(cls, v: object) -> object:
        if isinstance(v, str):
            v = " ".join(v.split())
            return v or None
        return v

    @field_validator("correo")
    @classmethod
    def normalizar_correo(cls, v: str | None) -> str | None:
        return v.lower() if v else None

    @model_validator(mode="after")
    def correo_o_telefono(self) -> "UsuarioActualizar":
        if not self.correo and not self.telefono:
            raise ValueError("Debes mantener al menos un correo o un teléfono")
        return self
