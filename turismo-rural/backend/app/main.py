import mimetypes
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import auth, emprendimientos, experiencias, pagos, reservas, usuarios

app = FastAPI(title="Turismo Rural API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}


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
