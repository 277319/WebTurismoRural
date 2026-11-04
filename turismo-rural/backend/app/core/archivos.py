import uuid
from pathlib import Path

from app.core.config import settings

DIR_FOTOS_EMPRENDIMIENTOS = Path(settings.UPLOADS_DIR) / "emprendimientos"


def detectar_extension_imagen(contenido: bytes) -> str | None:
    """Identifica la imagen por sus primeros bytes (no se confía en el nombre ni en el Content-Type)."""
    if contenido.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return "webp"
    return None


def guardar_foto_emprendimiento(contenido: bytes, extension: str) -> str:
    """Guarda la foto con un nombre aleatorio y devuelve ese nombre."""
    DIR_FOTOS_EMPRENDIMIENTOS.mkdir(parents=True, exist_ok=True)
    nombre = f"{uuid.uuid4().hex}.{extension}"
    (DIR_FOTOS_EMPRENDIMIENTOS / nombre).write_bytes(contenido)
    return nombre


def borrar_foto_emprendimiento(nombre: str | None) -> None:
    if nombre:
        (DIR_FOTOS_EMPRENDIMIENTOS / Path(nombre).name).unlink(missing_ok=True)


def url_foto_emprendimiento(nombre: str | None) -> str | None:
    """Ruta pública de la foto, servida por StaticFiles en /uploads."""
    return f"/uploads/emprendimientos/{nombre}" if nombre else None
