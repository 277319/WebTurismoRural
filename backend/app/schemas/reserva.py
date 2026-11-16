from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.experiencia import TipoExperiencia
from app.models.reserva import MAX_NOCHES, EstadoReserva, MetodoPago


class ReservaCrear(BaseModel):
    experiencia_id: int
    # En un hospedaje, el día de llegada
    fecha: date
    # Más de 1 solo en los hospedajes (se comprueba en el router)
    noches: int = Field(default=1, ge=1, le=MAX_NOCHES)
    # Que no supere la capacidad ni los cupos del día se comprueba en el router
    personas: int = Field(ge=1, le=1000)
    # Obligatorio si la experiencia tiene precio; en las gratuitas se ignora
    metodo_pago: MetodoPago | None = None
    # Adónde se avisan los cambios de la reserva (el frontend propone el de la cuenta)
    correo: EmailStr

    @field_validator("correo")
    @classmethod
    def normalizar_correo(cls, v: str) -> str:
        return v.strip().lower()


class EmprendimientoContacto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    telefono_contacto: str


class ExperienciaReservada(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: TipoExperiencia
    titulo: str
    localidad: str
    emprendimiento: EmprendimientoContacto


class ReservaPublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    experiencia_id: int
    experiencia: ExperienciaReservada
    fecha: date
    noches: int
    fecha_salida: date
    personas: int
    precio_por_persona: float
    total: float
    estado: EstadoReserva
    metodo_pago: MetodoPago | None
    correo: str | None
    fecha_creacion: datetime


class VisitanteReserva(BaseModel):
    """Datos de contacto del visitante, que solo ve el anfitrión de la experiencia reservada."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str | None
    correo: str | None
    telefono: str | None


class ReservaAnfitrion(ReservaPublica):
    visitante: VisitanteReserva
