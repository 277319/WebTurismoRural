from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_usuario_actual
from app.core.security import verify_password
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioActualizar, UsuarioPublico

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


def _conflicto(campo: str | None, mensaje: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, detail={"campo": campo, "mensaje": mensaje})


@router.get("/me", response_model=UsuarioPublico)
def obtener_mi_cuenta(usuario: Usuario = Depends(get_usuario_actual)) -> Usuario:
    return usuario


@router.put("/me", response_model=UsuarioPublico)
def actualizar_mi_cuenta(
    datos: UsuarioActualizar,
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
) -> Usuario:
    cambia_acceso = datos.correo != usuario.correo or datos.telefono != usuario.telefono

    if cambia_acceso:
        # Se usa 403 (y no 401) para que el frontend no lo confunda con una sesión expirada
        if not datos.contrasena_actual:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail={"campo": "contrasena_actual", "mensaje": "Ingresa tu contraseña actual para cambiar el correo o teléfono"},
            )
        if not verify_password(datos.contrasena_actual, usuario.contrasena_hash):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail={"campo": "contrasena_actual", "mensaje": "La contraseña actual no es correcta"},
            )

    if datos.correo and datos.correo != usuario.correo:
        if db.scalar(select(Usuario.id).where(Usuario.correo == datos.correo, Usuario.id != usuario.id)):
            raise _conflicto("correo", "Este correo ya está registrado")
    if datos.telefono and datos.telefono != usuario.telefono:
        if db.scalar(select(Usuario.id).where(Usuario.telefono == datos.telefono, Usuario.id != usuario.id)):
            raise _conflicto("telefono", "Este teléfono ya está registrado")

    usuario.nombre = datos.nombre
    usuario.correo = datos.correo
    usuario.telefono = datos.telefono
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _conflicto(None, "El correo o teléfono ya está registrado")
    db.refresh(usuario)
    return usuario
