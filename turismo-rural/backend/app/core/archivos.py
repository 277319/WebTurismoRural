import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

DIR_FOTOS_EMPRENDIMIENTOS = Path(settings.UPLOADS_DIR) / "emprendimientos"
DIR_FOTOS_EXPERIENCIAS = Path(settings.UPLOADS_DIR) / "experiencias"

# Las fotos de la galería se guardan como WebP con este lado mayor como máximo
LADO_MAXIMO_FOTO = 1600
CALIDAD_WEBP = 80
# Protege contra "bombas de descompresión" (imágenes pequeñas en bytes pero enormes al abrirlas)
Image.MAX_IMAGE_PIXELS = 50_000_000


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
    """Acepta el nombre del archivo o su ruta pública (/uploads/emprendimientos/...)."""
    if nombre:
        (DIR_FOTOS_EMPRENDIMIENTOS / Path(nombre).name).unlink(missing_ok=True)


def url_foto_emprendimiento(nombre: str | None) -> str | None:
    """Ruta pública de la foto, servida por StaticFiles en /uploads."""
    return f"/uploads/emprendimientos/{nombre}" if nombre else None


async def leer_imagen(archivo: UploadFile, campo: str, max_mb: int = settings.MAX_FOTO_MB) -> tuple[bytes, str]:
    """Lee la imagen subida respetando el límite de tamaño; devuelve (contenido, extensión) o 413/415."""
    limite = max_mb * 1024 * 1024
    contenido = await archivo.read(limite + 1)
    if len(contenido) > limite:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"campo": campo, "mensaje": f"La foto no puede superar los {max_mb} MB"},
        )
    extension = detectar_extension_imagen(contenido)
    if extension is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"campo": campo, "mensaje": "La foto debe ser JPG, PNG o WebP"},
        )
    return contenido, extension


def comprimir_imagen(contenido: bytes) -> bytes | None:
    """
    Endereza la foto según su EXIF, la reduce para que su lado mayor no pase de LADO_MAXIMO_FOTO
    y la recodifica como WebP (lo que además descarta los metadatos, como la ubicación GPS).
    Devuelve None si el archivo no es una imagen válida.
    """
    try:
        with Image.open(io.BytesIO(contenido), formats=["JPEG", "PNG", "WEBP"]) as imagen:
            imagen = ImageOps.exif_transpose(imagen)
            # Conserva la transparencia de PNG/WebP; el resto (CMYK, paleta, grises…) pasa a RGB
            tiene_alfa = "A" in imagen.getbands() or "transparency" in imagen.info
            imagen = imagen.convert("RGBA" if tiene_alfa else "RGB")
            imagen.thumbnail((LADO_MAXIMO_FOTO, LADO_MAXIMO_FOTO), Image.Resampling.LANCZOS)
            salida = io.BytesIO()
            imagen.save(salida, format="WEBP", quality=CALIDAD_WEBP, method=6)
            return salida.getvalue()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
        return None


def guardar_foto_experiencia(contenido: bytes) -> str:
    """Guarda la foto ya comprimida (WebP) con un nombre aleatorio y devuelve su ruta pública."""
    DIR_FOTOS_EXPERIENCIAS.mkdir(parents=True, exist_ok=True)
    nombre = f"{uuid.uuid4().hex}.webp"
    (DIR_FOTOS_EXPERIENCIAS / nombre).write_bytes(contenido)
    return f"/uploads/experiencias/{nombre}"


def borrar_foto_experiencia(url: str | None) -> None:
    """Recibe la ruta pública (/uploads/experiencias/...) y borra el archivo si existe."""
    if url:
        (DIR_FOTOS_EXPERIENCIAS / Path(url).name).unlink(missing_ok=True)
