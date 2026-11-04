import re
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import AfterValidator, BeforeValidator, Field

TELEFONO_RE = re.compile(r"^\+?\d{8,15}$")


def limpiar_telefono(valor: str) -> str:
    """Quita espacios, guiones, puntos y paréntesis: '+56 9 1234-5678' -> '+56912345678'."""
    return re.sub(r"[\s\-().]", "", valor)


def validar_telefono(valor: str) -> str:
    valor = limpiar_telefono(valor)
    if not TELEFONO_RE.fullmatch(valor):
        raise ValueError("El teléfono debe tener entre 8 y 15 dígitos")
    return valor


def validar_texto(valor: str) -> str:
    valor = " ".join(valor.split())
    if not valor:
        raise ValueError("Este campo es obligatorio")
    return valor


Telefono = Annotated[str, AfterValidator(validar_telefono)]
Texto100 = Annotated[str, Field(max_length=100), AfterValidator(validar_texto)]
Texto150 = Annotated[str, Field(max_length=150), AfterValidator(validar_texto)]
Texto255 = Annotated[str, Field(max_length=255), AfterValidator(validar_texto)]


# --- Textos largos (descripción, historia): conservan los saltos de línea ---

def texto_largo_o_none(valor: object) -> object:
    if isinstance(valor, str):
        valor = valor.replace("\r\n", "\n").strip()
        return valor or None
    return valor


TextoLargo2000 = Annotated[Annotated[str, Field(max_length=2000)] | None, BeforeValidator(texto_largo_o_none)]
TextoLargo5000 = Annotated[Annotated[str, Field(max_length=5000)] | None, BeforeValidator(texto_largo_o_none)]


# --- Redes sociales ---

def vacio_a_none(valor: object) -> object:
    if isinstance(valor, str):
        return valor.strip() or None
    return valor


def _usuario_de_red(dominio: str, patron: str, nombre: str):
    """Acepta '@usuario', 'usuario' o la URL del perfil, y devuelve solo 'usuario'."""
    url_re = re.compile(rf"^(?:https?://)?(?:www\.|m\.)?{re.escape(dominio)}/@?([^/?#\s]+)", re.IGNORECASE)
    usuario_re = re.compile(patron)

    def validar(valor: str) -> str:
        coincidencia = url_re.match(valor)
        usuario = coincidencia.group(1) if coincidencia else valor.lstrip("@")
        if not usuario_re.fullmatch(usuario):
            raise ValueError(f"Usuario de {nombre} no válido")
        return usuario

    return validar


def validar_sitio_web(valor: str) -> str:
    if not re.match(r"^https?://", valor, re.IGNORECASE):
        valor = "https://" + valor
    partes = urlsplit(valor)
    # Solo http(s): impide enlaces 'javascript:' u otros esquemas peligrosos
    if partes.scheme.lower() not in ("http", "https") or "." not in partes.netloc or " " in valor:
        raise ValueError("La dirección del sitio web no es válida")
    if len(valor) > 255:
        raise ValueError("La dirección del sitio web es demasiado larga")
    return valor


def _red(validador):
    return Annotated[str | None, BeforeValidator(vacio_a_none), AfterValidator(lambda v: validador(v) if v else v)]


UsuarioInstagram = _red(_usuario_de_red("instagram.com", r"[A-Za-z0-9._]{1,30}", "Instagram"))
UsuarioFacebook = _red(_usuario_de_red("facebook.com", r"[A-Za-z0-9.\-]{1,80}", "Facebook"))
UsuarioTiktok = _red(_usuario_de_red("tiktok.com", r"[A-Za-z0-9._]{2,24}", "TikTok"))
TelefonoWhatsapp = _red(validar_telefono)
SitioWeb = _red(validar_sitio_web)
