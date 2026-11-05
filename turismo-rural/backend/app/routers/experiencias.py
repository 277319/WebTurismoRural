import math

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.archivos import borrar_foto_experiencia, comprimir_imagen, guardar_foto_experiencia, leer_imagen
from app.core.config import settings
from app.core.db import get_db
from app.core.deps import requerir_rol
from app.models.emprendimiento import Emprendimiento
from app.models.experiencia import EstadoExperiencia, Experiencia
from app.models.foto_experiencia import MAX_FOTOS_EXPERIENCIA, FotoExperiencia
from app.models.usuario import RolUsuario, Usuario
from app.schemas.experiencia import (
    ExperienciaCrear,
    ExperienciaPublica,
    FotoExperienciaPublica,
    OrdenFotos,
    PaginaExperiencias,
)

router = APIRouter(prefix="/experiencias", tags=["experiencias"])

solo_anfitrion = requerir_rol(RolUsuario.anfitrion)


def obtener_propia(experiencia_id: int, usuario: Usuario, db: Session) -> Experiencia:
    """Devuelve la experiencia si existe y pertenece a un emprendimiento del usuario; si no, 404 o 403."""
    experiencia = db.get(Experiencia, experiencia_id)
    if experiencia is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Experiencia no encontrada")
    if experiencia.emprendimiento.usuario_id != usuario.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Solo el dueño puede editar esta experiencia")
    return experiencia


@router.get("", response_model=PaginaExperiencias)
def catalogo(
    pagina: int = Query(1, ge=1, description="Número de página, desde 1"),
    por_pagina: int = Query(12, ge=1, le=50, description="Resultados por página (máx. 50)"),
    db: Session = Depends(get_db),
) -> PaginaExperiencias:
    """Público: experiencias activas, de la más reciente a la más antigua."""
    filtro = Experiencia.estado == EstadoExperiencia.activo
    total = db.scalar(select(func.count()).select_from(Experiencia).where(filtro)) or 0
    consulta = (
        select(Experiencia)
        .where(filtro)
        .options(joinedload(Experiencia.emprendimiento), selectinload(Experiencia.fotos))
        .order_by(Experiencia.fecha_creacion.desc(), Experiencia.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
    )
    return PaginaExperiencias(
        items=[ExperienciaPublica.model_validate(e) for e in db.scalars(consulta)],
        total=total,
        pagina=pagina,
        por_pagina=por_pagina,
        paginas=math.ceil(total / por_pagina),
    )


@router.post("", response_model=ExperienciaPublica, status_code=status.HTTP_201_CREATED)
def crear_experiencia(
    datos: ExperienciaCrear,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Experiencia:
    emprendimiento = db.get(Emprendimiento, datos.emprendimiento_id)
    if emprendimiento is None or emprendimiento.usuario_id != usuario.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"campo": "emprendimiento_id", "mensaje": "Solo puedes publicar experiencias en tus emprendimientos"},
        )
    experiencia = Experiencia(**datos.model_dump())
    db.add(experiencia)
    db.commit()
    db.refresh(experiencia)
    return experiencia


@router.get("/mias", response_model=list[ExperienciaPublica])
def mis_experiencias(
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> list[Experiencia]:
    consulta = (
        select(Experiencia)
        .join(Experiencia.emprendimiento)
        .where(Emprendimiento.usuario_id == usuario.id)
        .options(joinedload(Experiencia.emprendimiento), selectinload(Experiencia.fotos))
        .order_by(Experiencia.fecha_creacion.desc())
    )
    return list(db.scalars(consulta))


@router.post(
    "/{experiencia_id}/fotos",
    response_model=FotoExperienciaPublica,
    status_code=status.HTTP_201_CREATED,
)
async def subir_foto_experiencia(
    experiencia_id: int,
    foto: UploadFile = File(description="JPG, PNG o WebP"),
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> FotoExperiencia:
    """Agrega una foto al final de la galería. Se redimensiona y comprime a WebP antes de guardarla."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    contenido, _ = await leer_imagen(foto, campo="foto", max_mb=settings.MAX_FOTO_EXPERIENCIA_MB)
    # Pillow es trabajo de CPU: fuera del event loop para no frenar otras peticiones
    comprimida = await run_in_threadpool(comprimir_imagen, contenido)
    if comprimida is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"campo": "foto", "mensaje": "No pudimos leer la imagen. Prueba con otro archivo JPG, PNG o WebP"},
        )

    # Bloquea la experiencia hasta el commit para que dos subidas simultáneas no superen el límite
    db.execute(select(Experiencia.id).where(Experiencia.id == experiencia.id).with_for_update())
    total, siguiente = db.execute(
        select(func.count(), func.coalesce(func.max(FotoExperiencia.orden) + 1, 0)).where(
            FotoExperiencia.experiencia_id == experiencia.id
        )
    ).one()
    if total >= MAX_FOTOS_EXPERIENCIA:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "campo": "foto",
                "mensaje": f"La galería admite hasta {MAX_FOTOS_EXPERIENCIA} fotos. Elimina alguna para agregar otra",
            },
        )

    url = guardar_foto_experiencia(comprimida)
    nueva = FotoExperiencia(experiencia_id=experiencia.id, url=url, orden=siguiente)
    db.add(nueva)
    try:
        db.commit()
    except Exception:
        borrar_foto_experiencia(url)
        raise
    db.refresh(nueva)
    return nueva


@router.put("/{experiencia_id}/fotos/orden", response_model=list[FotoExperienciaPublica])
def reordenar_fotos_experiencia(
    experiencia_id: int,
    datos: OrdenFotos,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> list[FotoExperiencia]:
    """Recibe los ids de todas las fotos en el nuevo orden; la primera pasa a ser la foto principal."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    fotos = {f.id: f for f in experiencia.fotos}
    if len(datos.ids) != len(fotos) or set(datos.ids) != fotos.keys():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="La galería cambió mientras la editabas. Recarga la página e inténtalo de nuevo",
        )
    for posicion, foto_id in enumerate(datos.ids):
        fotos[foto_id].orden = posicion
    db.commit()
    return experiencia.fotos


@router.delete("/{experiencia_id}/fotos/{foto_id}", response_model=list[FotoExperienciaPublica])
def eliminar_foto_experiencia(
    experiencia_id: int,
    foto_id: int,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> list[FotoExperiencia]:
    """Quita la foto de la galería y del disco; devuelve las fotos que quedan, renumeradas desde 0."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    foto = next((f for f in experiencia.fotos if f.id == foto_id), None)
    if foto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")

    url = foto.url
    experiencia.fotos.remove(foto)  # delete-orphan: se borra la fila
    for posicion, restante in enumerate(experiencia.fotos):
        restante.orden = posicion
    db.commit()
    borrar_foto_experiencia(url)
    return experiencia.fotos
