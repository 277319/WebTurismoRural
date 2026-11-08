from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import decode_access_token
from app.models.usuario import RolUsuario, Usuario

bearer = HTTPBearer(auto_error=False)


def get_usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    error = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o sesión expirada",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credenciales is None:
        raise error
    sub = decode_access_token(credenciales.credentials)
    if sub is None or not sub.isdigit():
        raise error
    usuario = db.get(Usuario, int(sub))
    if usuario is None:
        raise error
    return usuario


def get_usuario_opcional(
    credenciales: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario | None:
    """Para rutas públicas que muestran algo más al usuario identificado. Un token inválido cuenta como anónimo."""
    if credenciales is None:
        return None
    sub = decode_access_token(credenciales.credentials)
    if sub is None or not sub.isdigit():
        return None
    return db.get(Usuario, int(sub))


def requerir_rol(*roles: RolUsuario):
    """Dependencia que exige que el usuario autenticado tenga uno de los roles indicados."""

    def dependencia(usuario: Usuario = Depends(get_usuario_actual)) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No tienes permiso para realizar esta acción")
        return usuario

    return dependencia
