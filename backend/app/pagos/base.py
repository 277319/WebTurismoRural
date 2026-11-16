"""Interfaz común de los proveedores de pago: el resto del backend solo conoce esto."""

import json
import urllib.error
import urllib.request
from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from app.core.config import settings
from app.models.pago import EstadoPago, Pago


@dataclass(frozen=True)
class Cobro:
    """Cobro creado en el proveedor."""

    # Página del proveedor a la que se envía al visitante para pagar
    url_pago: str
    # Id del cobro en el proveedor, si tiene uno
    id_cobro: str | None


@dataclass(frozen=True)
class Notificacion:
    """Lo que el proveedor informa sobre un pago, ya verificado."""

    pago_id: int
    estado: EstadoPago
    # Id de la transacción en el proveedor
    id_transaccion: str | None
    # Monto cobrado, para compararlo con el del pago
    monto: Decimal


class FirmaInvalida(Exception):
    """El aviso no viene del proveedor (o se modificó en el camino)."""


class ErrorProveedor(Exception):
    """El proveedor no respondió o respondió con un error."""


class ProveedorPago(ABC):
    """
    Cada proveedor sabe crear un cobro y leer sus avisos (webhooks). Para agregar uno nuevo, se implementan
    estos dos métodos y se registra en `app.pagos.obtener_proveedor`.
    """

    # Se guarda en cada Pago: los avisos de un proveedor solo pueden resolver pagos creados por él
    nombre: str

    @abstractmethod
    def crear_cobro(self, pago: Pago, descripcion: str) -> Cobro:
        """Crea el cobro de `pago.monto` en el proveedor. Lanza ErrorProveedor si no se pudo."""

    @abstractmethod
    def leer_notificacion(
        self, cuerpo: bytes, cabeceras: Mapping[str, str], parametros: Mapping[str, str]
    ) -> Notificacion | None:
        """
        Verifica y traduce un aviso recibido en el webhook. Devuelve None si el aviso no es sobre un pago
        (el proveedor puede avisar de otras cosas). Lanza FirmaInvalida o ErrorProveedor.
        """


def url_resultado(pago_id: int, exito: bool) -> str:
    """Página del frontend a la que vuelve el visitante después de pagar (o de no hacerlo)."""
    return f"{settings.FRONTEND_URL}/pagos/{pago_id}/{'exito' if exito else 'fallo'}"


def url_webhook() -> str:
    return f"{settings.BACKEND_URL}/pagos/webhook"


def peticion_json(
    metodo: str, url: str, cuerpo: dict[str, Any] | bytes | None = None, cabeceras: dict[str, str] | None = None
) -> dict[str, Any]:
    """
    Petición HTTP con cuerpo y respuesta JSON. El cuerpo puede ir ya serializado (p. ej. si se firmó).
    Lanza ErrorProveedor si falla o no responde 2xx.
    """
    datos = cuerpo if isinstance(cuerpo, bytes) or cuerpo is None else json.dumps(cuerpo).encode()
    solicitud = urllib.request.Request(
        url, data=datos, method=metodo, headers={"Content-Type": "application/json", **(cabeceras or {})}
    )
    try:
        with urllib.request.urlopen(solicitud, timeout=15) as respuesta:
            contenido = respuesta.read()
    except urllib.error.HTTPError as e:
        raise ErrorProveedor(f"{metodo} {url} respondió {e.code}: {e.read()[:500]!r}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise ErrorProveedor(f"{metodo} {url} no respondió: {e}") from e
    return json.loads(contenido) if contenido else {}
