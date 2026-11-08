from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.core.archivos import url_foto_emprendimiento
from app.models.disponibilidad_experiencia import MAX_DIAS_DISPONIBILIDAD
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


class ExperienciaEditar(ExperienciaCrear):
    """PUT /experiencias/{id}: reemplaza todos los datos. Las fotos se gestionan en /fotos."""

    # Obligatorio: si tuviera valor por defecto, un PUT sin estado reactivaría una experiencia pausada
    estado: EstadoExperiencia


class ExperienciaEstado(BaseModel):
    """PATCH /experiencias/{id}/estado: pausar o reanudar."""

    estado: EstadoExperiencia


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


class DiaDisponible(BaseModel):
    fecha: date
    # Cupos libres: ya descontadas las personas con reserva activa
    cupos: int
    reservados: int = 0


class DiaDisponibleEditar(BaseModel):
    fecha: date
    # Cupos libres; 0 = día abierto pero completo. Que no supere la capacidad se comprueba en el router
    cupos: int = Field(ge=0, le=1000)


class DisponibilidadEditar(BaseModel):
    """PUT /experiencias/{id}/disponibilidad: todos los días disponibles desde hoy. Los que falten se cierran."""

    dias: list[DiaDisponibleEditar] = Field(max_length=MAX_DIAS_DISPONIBILIDAD + 1)

    @field_validator("dias")
    @classmethod
    def sin_fechas_repetidas(cls, v: list[DiaDisponibleEditar]) -> list[DiaDisponibleEditar]:
        if len({d.fecha for d in v}) != len(v):
            raise ValueError("Hay fechas repetidas")
        return sorted(v, key=lambda d: d.fecha)


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


class ExperienciaPropia(ExperienciaPublica):
    """GET /experiencias/mias: incluye lo que el anfitrión tiene que atender."""

    # Reservas de hoy en adelante que esperan su confirmación
    reservas_pendientes: int = 0


class EmprendimientoAnfitrion(EmprendimientoResumen):
    """Datos públicos del emprendimiento anfitrión, para el detalle de una experiencia."""

    localidad: str
    descripcion: str | None
    telefono_contacto: str
    redes: dict[str, str]
    usuario_id: int


class ExperienciaDetalle(ExperienciaPublica):
    emprendimiento: EmprendimientoAnfitrion


class PaginaExperiencias(BaseModel):
    items: list[ExperienciaPublica]
    total: int
    pagina: int
    por_pagina: int
    paginas: int
