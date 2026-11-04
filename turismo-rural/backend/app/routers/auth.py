from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_usuario_actual
from app.core.security import create_access_token, hash_password, verify_password
from app.models.emprendimiento import Emprendimiento
from app.models.usuario import Usuario
from app.schemas.usuario import Token, UsuarioLogin, UsuarioPublico, UsuarioRegistro
from app.schemas.validadores import limpiar_telefono

router = APIRouter(prefix="/auth", tags=["auth"])

# Hash con el que comparar cuando el usuario no existe, para que la respuesta
# tarde lo mismo y no revele qué correos/teléfonos están registrados
HASH_FICTICIO = hash_password("contrasena-ficticia")


@router.post("/registro", response_model=UsuarioPublico, status_code=status.HTTP_201_CREATED)
def registro(datos: UsuarioRegistro, db: Session = Depends(get_db)) -> Usuario:
    if datos.correo and db.scalar(select(Usuario.id).where(Usuario.correo == datos.correo)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"campo": "correo", "mensaje": "Este correo ya está registrado"})
    if datos.telefono and db.scalar(select(Usuario.id).where(Usuario.telefono == datos.telefono)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"campo": "telefono", "mensaje": "Este teléfono ya está registrado"})

    usuario = Usuario(
        correo=datos.correo,
        telefono=datos.telefono,
        contrasena_hash=hash_password(datos.contrasena),
        rol=datos.rol,
    )
    if datos.emprendimiento:
        # Se guarda junto al usuario en la misma transacción
        usuario.emprendimientos.append(Emprendimiento(**datos.emprendimiento.model_dump()))
    db.add(usuario)
    try:
        db.commit()
    except IntegrityError:
        # Otro registro con el mismo correo/teléfono se coló entre la comprobación y el commit
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"campo": None, "mensaje": "El correo o teléfono ya está registrado"})
    db.refresh(usuario)
    return usuario


@router.post("/login", response_model=Token)
def login(datos: UsuarioLogin, db: Session = Depends(get_db)) -> Token:
    identificador = datos.identificador.strip()
    if "@" in identificador:
        condicion = Usuario.correo == identificador.lower()
    else:
        condicion = Usuario.telefono == limpiar_telefono(identificador)
    usuario = db.scalar(select(Usuario).where(condicion))

    if usuario is None:
        verify_password(datos.contrasena, HASH_FICTICIO)
        usuario_valido = False
    else:
        usuario_valido = verify_password(datos.contrasena, usuario.contrasena_hash)

    if not usuario_valido:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Correo, teléfono o contraseña incorrectos")

    return Token(
        access_token=create_access_token(str(usuario.id)),
        usuario=UsuarioPublico.model_validate(usuario),
    )


@router.get("/me", response_model=UsuarioPublico)
def me(usuario: Usuario = Depends(get_usuario_actual)) -> Usuario:
    return usuario
