import mimetypes
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import auth, emprendimientos, experiencias, health, pagos, reservas, usuarios


class PrefijoProxy:
    """nginx quita /api de la ruta y lo avisa en X-Forwarded-Prefix. Con ese root_path, /docs pide
    /api/openapi.json cuando se abre por nginx y /openapi.json cuando se abre directo en el puerto 8000."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            prefijo = dict(scope["headers"]).get(b"x-forwarded-prefix", b"").decode("latin-1").rstrip("/")
            if prefijo:
                # Starlette espera que path incluya root_path (y se lo quita al enrutar)
                scope = dict(scope, root_path=prefijo, path=prefijo + scope["path"])
        await self.app(scope, receive, send)


app = FastAPI(title="Turismo Rural API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(PrefijoProxy)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(emprendimientos.router)
app.include_router(usuarios.router)
app.include_router(experiencias.router)
app.include_router(reservas.router)
app.include_router(pagos.router)

# Fotos subidas por los usuarios (p. ej. /uploads/emprendimientos/abc123.jpg)
# python:slim no trae /etc/mime.types: sin esto, las .webp se servirían como text/plain
mimetypes.add_type("image/webp", ".webp")
Path(settings.UPLOADS_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOADS_DIR), name="uploads")
