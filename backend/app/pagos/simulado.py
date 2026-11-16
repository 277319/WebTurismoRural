"""
Pasarela de prueba propia: no mueve dinero ni necesita cuentas externas.

Se comporta como un proveedor real: el cobro lleva al visitante a una página de pago (en el frontend),
donde elige aprobar o rechazar, y el resultado llega al webhook como un aviso HTTP firmado. Así el
webhook se ejercita igual que con un proveedor de verdad.
"""

import hashlib
import hmac
import json
import logging
import secrets
from collections.abc import Mapping
from decimal import Decimal

from app.core.config import settings
from app.models.pago import EstadoPago, Pago
from app.pagos.base import (
    Cobro,
    ErrorProveedor,
    FirmaInvalida,
    Notificacion,
    ProveedorPago,
    peticion_json,
    url_webhook,
)

logger = logging.getLogger(__name__)

CABECERA_FIRMA = "X-Firma-Simulada"


def firmar(cuerpo: bytes) -> str:
    # Clave derivada de SECRET_KEY: distinta de la de los tokens, pero sin otra variable que configurar
    clave = hashlib.sha256(f"pago-simulado:{settings.SECRET_KEY}".encode()).digest()
    return hmac.new(clave, cuerpo, hashlib.sha256).hexdigest()


class ProveedorSimulado(ProveedorPago):
    nombre = "simulado"

    def crear_cobro(self, pago: Pago, descripcion: str) -> Cobro:
        return Cobro(url_pago=f"{settings.FRONTEND_URL}/pagos/{pago.id}/simulado", id_cobro=f"sim-{pago.id}")

    def leer_notificacion(
        self, cuerpo: bytes, cabeceras: Mapping[str, str], parametros: Mapping[str, str]
    ) -> Notificacion | None:
        if not hmac.compare_digest(cabeceras.get(CABECERA_FIRMA, ""), firmar(cuerpo)):
            raise FirmaInvalida("Firma del aviso simulado incorrecta")
        datos = json.loads(cuerpo)
        return Notificacion(
            pago_id=int(datos["pago_id"]),
            estado=EstadoPago(datos["estado"]),
            id_transaccion=datos["id_transaccion"],
            monto=Decimal(datos["monto"]),
        )

    def notificar(self, pago_id: int, estado: EstadoPago, monto: Decimal) -> None:
        """Envía al webhook el resultado elegido en la página de pago, como lo haría el proveedor."""
        cuerpo = json.dumps(
            {
                "pago_id": pago_id,
                "estado": estado.value,
                "id_transaccion": f"sim-{secrets.token_hex(6)}",
                "monto": str(monto),
            }
        ).encode()
        try:
            peticion_json("POST", url_webhook(), cuerpo=cuerpo, cabeceras={CABECERA_FIRMA: firmar(cuerpo)})
        except ErrorProveedor:
            logger.exception("No se pudo avisar al webhook el resultado del pago simulado %s", pago_id)
