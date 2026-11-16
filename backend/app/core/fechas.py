from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings


def hoy() -> date:
    """Fecha actual en la zona horaria del sitio (no la del servidor, que corre en UTC)."""
    return datetime.now(ZoneInfo(settings.ZONA_HORARIA)).date()
