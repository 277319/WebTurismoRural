import logging
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from app.core.config import settings

logger = logging.getLogger(__name__)

CARPETA_PLANTILLAS = Path(__file__).resolve().parent.parent / "templates" / "correos"

# Entorno propio en lugar del de fastapi-mail, que no escapa el HTML: los títulos de las experiencias
# y los nombres los escriben los usuarios y no deben poder inyectar enlaces o etiquetas en el correo
plantillas = Environment(
    loader=FileSystemLoader(CARPETA_PLANTILLAS),
    autoescape=select_autoescape(["html"]),
    undefined=StrictUndefined,
)

correo = FastMail(
    ConnectionConfig(
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
        MAIL_STARTTLS=settings.MAIL_STARTTLS,
        MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
        USE_CREDENTIALS=bool(settings.MAIL_USERNAME),
        SUPPRESS_SEND=0 if settings.MAIL_ENVIAR else 1,
    )
)


async def enviar_correo(destinatario: str, asunto: str, plantilla: str, datos: dict[str, Any]) -> None:
    """
    Pensada para correr como tarea en segundo plano, cuando la respuesta ya se envió:
    si algo falla (el SMTP no responde, la dirección no existe) solo queda en el log.
    """
    try:
        html = plantillas.get_template(plantilla).render(asunto=asunto, **datos)
        mensaje = MessageSchema(recipients=[destinatario], subject=asunto, body=html, subtype=MessageType.html)
        await correo.send_message(mensaje)
    except Exception:
        logger.exception("No se pudo enviar el correo %r a %s", asunto, destinatario)


def programar_correo(
    tareas: BackgroundTasks, destinatario: str | None, asunto: str, plantilla: str, **datos: Any
) -> None:
    """
    Deja el correo para después de responder. `datos` deben ser valores simples (no modelos):
    la sesión de la base ya está cerrada cuando corre la tarea.
    """
    # Los usuarios registrados solo con teléfono no reciben correos
    if destinatario:
        tareas.add_task(enviar_correo, destinatario, asunto, plantilla, datos)
