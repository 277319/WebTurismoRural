from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.pago import EstadoPago
from app.schemas.reserva import ReservaPublica


class PagoCrear(BaseModel):
    reserva_id: int


class PagoIniciado(BaseModel):
    id: int
    # Página del proveedor a la que se envía al visitante
    url_pago: str


class PagoPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reserva_id: int
    reserva: ReservaPublica
    proveedor: str
    monto: float
    estado: EstadoPago
    fecha_creacion: datetime


class PagoSimulado(BaseModel):
    """Lo que elige el visitante en la pasarela simulada."""

    aprobar: bool
