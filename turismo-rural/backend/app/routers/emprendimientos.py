from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.archivos import (
    borrar_foto_emprendimiento,
    borrar_foto_experiencia,
    guardar_foto_emprendimiento,
    leer_imagen,
    url_foto_emprendimiento,
)
from app.core.db import get_db
from app.core.deps import requerir_rol
from app.models.emprendimiento import Emprendimiento
from app.models.usuario import RolUsuario, Usuario
from app.schemas.emprendimiento import (
    EmprendimientoCrear,
    EmprendimientoEditar,
    EmprendimientoPersonalizar,
    EmprendimientoPublico,
)

router = APIRouter(prefix="/emprendimientos", tags=["emprendimientos"])

solo_anfitrion = requerir_rol(RolUsuario.anfitrion)


def obtener_propio(emprendimiento_id: int, usuario: Usuario, db: Session) -> Emprendimiento:
    """Devuelve el emprendimiento si existe y pertenece al usuario; si no, 404 o 403."""
    emprendimiento = db.get(Emprendimiento, emprendimiento_id)
    if emprendimiento is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Emprendimiento no encontrado")
    if emprendimiento.usuario_id != usuario.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Solo el dueño puede modificar este emprendimiento")
    return emprendimiento


@router.post("", response_model=EmprendimientoPublico, status_code=status.HTTP_201_CREATED)
def crear_emprendimiento(
    datos: EmprendimientoCrear,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Emprendimiento:
    emprendimiento = Emprendimiento(**datos.model_dump(), usuario_id=usuario.id)
    db.add(emprendimiento)
    db.commit()
    db.refresh(emprendimiento)
    return emprendimiento


@router.get("/mios", response_model=list[EmprendimientoPublico])
def mis_emprendimientos(
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> list[Emprendimiento]:
    consulta = (
        select(Emprendimiento)
        .where(Emprendimiento.usuario_id == usuario.id)
        .order_by(Emprendimiento.fecha_creacion.desc())
    )
    return list(db.scalars(consulta))


@router.get("/{emprendimiento_id}", response_model=EmprendimientoPublico)
def obtener_emprendimiento(emprendimiento_id: int, db: Session = Depends(get_db)) -> Emprendimiento:
    """Público: cualquiera puede ver la ficha de un emprendimiento."""
    emprendimiento = db.get(Emprendimiento, emprendimiento_id)
    if emprendimiento is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Emprendimiento no encontrado")
    return emprendimiento


@router.put("/{emprendimiento_id}", response_model=EmprendimientoPublico)
def editar_emprendimiento(
    emprendimiento_id: int,
    datos: EmprendimientoEditar,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Emprendimiento:
    emprendimiento = obtener_propio(emprendimiento_id, usuario, db)
    valores = datos.model_dump(exclude={"redes"})
    for campo, valor in valores.items():
        setattr(emprendimiento, campo, valor)
    emprendimiento.redes = datos.redes.model_dump(exclude_none=True)
    db.commit()
    db.refresh(emprendimiento)
    return emprendimiento


@router.delete("/{emprendimiento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_emprendimiento(
    emprendimiento_id: int,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> None:
    """Borra el emprendimiento con todas sus experiencias y fotos (filas y archivos). No se puede deshacer."""
    emprendimiento = obtener_propio(emprendimiento_id, usuario, db)
    fotos_emprendimiento = [emprendimiento.foto_perfil, emprendimiento.portada_url]
    fotos_experiencias = [f.url for e in emprendimiento.experiencias for f in e.fotos]
    db.delete(emprendimiento)
    db.commit()
    # Los archivos se borran después del commit: si este falla, las fotos siguen intactas
    for nombre in fotos_emprendimiento:
        borrar_foto_emprendimiento(nombre)
    for url in fotos_experiencias:
        borrar_foto_experiencia(url)


@router.put("/{emprendimiento_id}/foto", response_model=EmprendimientoPublico)
async def subir_foto(
    emprendimiento_id: int,
    foto: UploadFile = File(description="JPG, PNG o WebP"),
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Emprendimiento:
    emprendimiento = obtener_propio(emprendimiento_id, usuario, db)
    contenido, extension = await leer_imagen(foto, campo="foto")

    anterior = emprendimiento.foto_perfil
    emprendimiento.foto_perfil = guardar_foto_emprendimiento(contenido, extension)
    db.commit()
    borrar_foto_emprendimiento(anterior)
    db.refresh(emprendimiento)
    return emprendimiento


@router.put("/{emprendimiento_id}/personalizacion", response_model=EmprendimientoPublico)
def personalizar_emprendimiento(
    emprendimiento_id: int,
    datos: EmprendimientoPersonalizar,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Emprendimiento:
    """Colores, relato de la comunidad y bloques opcionales de la página pública."""
    emprendimiento = obtener_propio(emprendimiento_id, usuario, db)
    emprendimiento.color_primario = datos.color_primario
    emprendimiento.color_secundario = datos.color_secundario
    emprendimiento.relato_comunidad = datos.relato_comunidad
    emprendimiento.bloques = datos.bloques.model_dump()
    db.commit()
    db.refresh(emprendimiento)
    return emprendimiento


@router.put("/{emprendimiento_id}/portada", response_model=EmprendimientoPublico)
async def subir_portada(
    emprendimiento_id: int,
    portada: UploadFile = File(description="JPG, PNG o WebP"),
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Emprendimiento:
    emprendimiento = obtener_propio(emprendimiento_id, usuario, db)
    contenido, extension = await leer_imagen(portada, campo="portada")

    anterior = emprendimiento.portada_url
    emprendimiento.portada_url = url_foto_emprendimiento(guardar_foto_emprendimiento(contenido, extension))
    db.commit()
    borrar_foto_emprendimiento(anterior)
    db.refresh(emprendimiento)
    return emprendimiento


@router.delete("/{emprendimiento_id}/portada", response_model=EmprendimientoPublico)
def quitar_portada(
    emprendimiento_id: int,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Emprendimiento:
    emprendimiento = obtener_propio(emprendimiento_id, usuario, db)
    anterior = emprendimiento.portada_url
    emprendimiento.portada_url = None
    db.commit()
    borrar_foto_emprendimiento(anterior)
    db.refresh(emprendimiento)
    return emprendimiento
