"""Pagos en línea. El proveedor se elige con PROVEEDOR_PAGO; el resto del backend usa solo ProveedorPago."""

from functools import cache

from app.core.config import settings
from app.pagos.base import ProveedorPago


@cache
def obtener_proveedor() -> ProveedorPago:
    if settings.PROVEEDOR_PAGO == "mercadopago":
        from app.pagos.mercadopago import ProveedorMercadoPago

        return ProveedorMercadoPago(settings.MP_ACCESS_TOKEN, settings.MP_WEBHOOK_SECRET, settings.MP_SANDBOX)
    from app.pagos.simulado import ProveedorSimulado

    return ProveedorSimulado()
