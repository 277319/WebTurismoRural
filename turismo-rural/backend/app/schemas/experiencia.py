from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.core.archivos import url_foto_emprendimiento
from app.models.experiencia import EstadoExperiencia, TipoExperiencia
from app.models.foto_experiencia import MAX_FOTOS_EXPERIENCIA
from app.schemas.validadores import Texto100, Texto150


class ExperienciaCrear(BaseModel):
    emprendimiento_id: int
    tipo: TipoExperiencia
    titulo: Texto150
    descripcion: str = Field(max_length=5000)
    precio_por_persona: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    capacidad_maxima: int = Field(ge=1, le=1000)
    localidad: Texto100
    latitud: float | None = Field(default=None, ge=-90, le=90)
    longitud: float | None = Field(default=None, ge=-180, le=180)
    estado: EstadoExperiencia = EstadoExperiencia.activo

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion(cls, v: str) -> str:
        v = v.replace("\r\n", "\n").strip()
        if not v:
            raise ValueError("Este campo es obligatorio")
        return v

    @model_validator(mode="after")
    def coordenadas_completas(self) -> "ExperienciaCrear":
        if (self.latitud is None) != (self.longitud is None):
            raise ValueError("Indica latitud y longitud, o deja ambas vacías")
        return self


class EmprendimientoResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    foto_perfil: str | None = Field(exclude=True)

    @computed_field
    @property
    def foto_url(self) -> str | None:
        return url_foto_emprendimiento(self.foto_perfil)


class FotoExperienciaPublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    orden: int


class OrdenFotos(BaseModel):
    """Ids de todas las fotos de la galería, en el nuevo orden."""

    ids: list[int] = Field(max_length=MAX_FOTOS_EXPERIENCIA)


class ExperienciaPublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    emprendimiento_id: int
    emprendimiento: EmprendimientoResumen
    tipo: TipoExperiencia
    titulo: str
    descripcion: str
    precio_por_persona: float
    capacidad_maxima: int
    localidad: str
    latitud: float | None
    longitud: float | None
    estado: EstadoExperiencia
    fotos: list[FotoExperienciaPublica]
    fecha_creacion: datetime
    fecha_actualizacion: datetime


class PaginaExperiencias(BaseModel):
    items: list[ExperienciaPublica]
    total: int
    pagina: int
    por_pagina: int
    paginas: int
