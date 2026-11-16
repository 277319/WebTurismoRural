"""
Mercado Pago, con Checkout Pro: el visitante paga en la página de Mercado Pago y vuelve al sitio.

Con credenciales de prueba todo ocurre en su sandbox (tarjetas de prueba, sin dinero real). Para que los
avisos lleguen, BACKEND_URL tiene que ser accesible desde internet (en desarrollo, un túnel como ngrok).
"""

import hashlib
import hmac
import json
from collections.abc import Mapping
from decimal import Decimal

from app.core.config import settings
from app.models.pago import EstadoPago, Pago
from app.pagos.base import (
    Cobro,
    FirmaInvalida,
    Notificacion,
    ProveedorPago,
    peticion_json,
    url_resultado,
    url_webhook,
)

API = "https://api.mercadopago.com"

# Estados de un pago de Mercado Pago. Los que no están aquí (pending, in_process, authorized…) aún no se resuelven
ESTADOS = {
    "approved": EstadoPago.aprobado,
    "rejected": EstadoPago.rechazado,
    "cancelled": EstadoPago.rechazado,
}


class ProveedorMercadoPago(ProveedorPago):
    nombre = "mercadopago"

    def __init__(self, access_token: str, secreto_webhook: str = "", sandbox: bool = True) -> None:
        if not access_token:
            raise RuntimeError("Falta MP_ACCESS_TOKEN para usar Mercado Pago como proveedor de pago")
        self.access_token = access_token
        self.secreto_webhook = secreto_webhook
        self.sandbox = sandbox

    def _autorizacion(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}

    def crear_cobro(self, pago: Pago, descripcion: str) -> Cobro:
        # Los pesos chilenos no admiten decimales en Mercado Pago
        monto = int(pago.monto) if pago.monto == pago.monto.to_integral_value() else float(pago.monto)
        preferencia = {
            "items": [
                {
                    "id": str(pago.reserva_id),
                    "title": descripcion[:256],
                    "quantity": 1,
                    "unit_price": monto,
                    "currency_id": "CLP",
                }
            ],
            # Así el aviso dice a qué pago corresponde
            "external_reference": str(pago.id),
            "notification_url": url_webhook(),
            "back_urls": {
                "success": url_resultado(pago.id, exito=True),
                "pending": url_resultado(pago.id, exito=True),
                "failure": url_resultado(pago.id, exito=False),
            },
        }
        # Mercado Pago solo devuelve automáticamente al visitante a direcciones https
        if settings.FRONTEND_URL.startswith("https://"):
            preferencia["auto_return"] = "approved"
        respuesta = peticion_json("POST", f"{API}/checkout/preferences", preferencia, self._autorizacion())
        url = respuesta["sandbox_init_point"] if self.sandbox else respuesta["init_point"]
        return Cobro(url_pago=url, id_cobro=respuesta["id"])

    def leer_notificacion(
        self, cuerpo: bytes, cabeceras: Mapping[str, str], parametros: Mapping[str, str]
    ) -> Notificacion | None:
        try:
            datos = json.loads(cuerpo) if cuerpo else {}
        except ValueError:
            datos = {}
        # Webhooks: ?type=payment&data.id=…; los avisos IPN antiguos usan ?topic=payment&id=…
        tipo = parametros.get("type") or parametros.get("topic") or datos.get("type")
        id_pago = parametros.get("data.id") or (datos.get("data") or {}).get("id") or parametros.get("id")
        if tipo != "payment" or not id_pago:
            # También avisa de órdenes y otros cambios que aquí no interesan
            return None
        if self.secreto_webhook:
            self._verificar_firma(str(id_pago), cabeceras)

        # El aviso solo trae el id: el estado y el monto se consultan a la API, así no se confía en el cuerpo
        pago_mp = peticion_json("GET", f"{API}/v1/payments/{id_pago}", cabeceras=self._autorizacion())
        referencia = str(pago_mp.get("external_reference") or "")
        estado = ESTADOS.get(pago_mp.get("status"))
        if not referencia.isdigit() or estado is None:
            # No es un pago creado por este sitio, o aún no se resuelve
            return None
        return Notificacion(
            pago_id=int(referencia),
            estado=estado,
            id_transaccion=str(pago_mp["id"]),
            monto=Decimal(str(pago_mp["transaction_amount"])),
        )

    def _verificar_firma(self, id_pago: str, cabeceras: Mapping[str, str]) -> None:
        """Firma de los webhooks: HMAC-SHA256 de "id:…;request-id:…;ts:…;" con la clave secreta."""
        partes = dict(
            parte.strip().split("=", 1) for parte in cabeceras.get("x-signature", "").split(",") if "=" in parte
        )
        ts, firma = partes.get("ts"), partes.get("v1")
        if not ts or not firma:
            raise FirmaInvalida("Aviso de Mercado Pago sin firma")
        manifiesto = f"id:{id_pago.lower() if id_pago.isalnum() else id_pago};"
        if request_id := cabeceras.get("x-request-id"):
            manifiesto += f"request-id:{request_id};"
        manifiesto += f"ts:{ts};"
        esperada = hmac.new(self.secreto_webhook.encode(), manifiesto.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(esperada, firma):
            raise FirmaInvalida("Firma de Mercado Pago incorrecta")
