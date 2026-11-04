import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.db import get_db
from app.core.deps import requerir_rol
from app.models.emprendimiento import Emprendimiento
from app.models.experiencia import EstadoExperiencia, Experiencia
from app.models.usuario import RolUsuario, Usuario
from app.schemas.experiencia import ExperienciaCrear, ExperienciaPublica, PaginaExperiencias

router = APIRouter(prefix="/experiencias", tags=["experiencias"])

solo_anfitrion = requerir_rol(RolUsuario.anfitrion)


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
        .options(joinedload(Experiencia.emprendimiento))
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
        .options(joinedload(Experiencia.emprendimiento))
        .order_by(Experiencia.fecha_creacion.desc())
    )
    return list(db.scalars(consulta))
