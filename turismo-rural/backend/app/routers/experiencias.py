import math
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import String, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.archivos import borrar_foto_experiencia, comprimir_imagen, guardar_foto_experiencia, leer_imagen
from app.core.config import settings
from app.core.db import get_db
from app.core.deps import get_usuario_opcional, requerir_rol
from app.models.emprendimiento import Emprendimiento
from app.models.experiencia import EstadoExperiencia, Experiencia, TipoExperiencia
from app.models.foto_experiencia import MAX_FOTOS_EXPERIENCIA, FotoExperiencia
from app.models.usuario import RolUsuario, Usuario
from app.schemas.experiencia import (
    ExperienciaCrear,
    ExperienciaDetalle,
    ExperienciaEditar,
    ExperienciaEstado,
    ExperienciaPublica,
    FotoExperienciaPublica,
    OrdenFotos,
    PaginaExperiencias,
)

router = APIRouter(prefix="/experiencias", tags=["experiencias"])

solo_anfitrion = requerir_rol(RolUsuario.anfitrion)

# Para buscar localidades sin distinguir tildes: "pucon" encuentra "Pucón"
CON_TILDE = "áéíóúüàèìòù"
SIN_TILDE = "aeiouuaeiou"
QUITAR_TILDES = str.maketrans(CON_TILDE, SIN_TILDE)


def normalizar_localidad(columna):
    """Versión en minúsculas y sin tildes de la columna, calculada por PostgreSQL."""
    return func.translate(func.lower(columna), CON_TILDE, SIN_TILDE, type_=String)


def obtener_propia(experiencia_id: int, usuario: Usuario, db: Session) -> Experiencia:
    """Devuelve la experiencia si existe y pertenece a un emprendimiento del usuario; si no, 404 o 403."""
    experiencia = db.get(Experiencia, experiencia_id)
    if experiencia is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Experiencia no encontrada")
    if experiencia.emprendimiento.usuario_id != usuario.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Solo el dueño puede modificar esta experiencia")
    return experiencia


def verificar_emprendimiento_propio(emprendimiento_id: int, usuario: Usuario, db: Session) -> None:
    """403 si el emprendimiento no existe o no es del usuario (no se distingue, para no revelar cuáles existen)."""
    emprendimiento = db.get(Emprendimiento, emprendimiento_id)
    if emprendimiento is None or emprendimiento.usuario_id != usuario.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"campo": "emprendimiento_id", "mensaje": "Solo puedes publicar experiencias en tus emprendimientos"},
        )


@router.get("", response_model=PaginaExperiencias)
def catalogo(
    pagina: int = Query(1, ge=1, description="Número de página, desde 1"),
    por_pagina: int = Query(12, ge=1, le=50, description="Resultados por página (máx. 50)"),
    localidad: str | None = Query(
        None, max_length=100, description="Parte del nombre de la localidad; no distingue mayúsculas ni tildes"
    ),
    tipo: list[TipoExperiencia] | None = Query(
        None, description="Uno o más tipos; se repite el parámetro: ?tipo=pesca&tipo=senderismo"
    ),
    precio_min: Decimal | None = Query(None, ge=0, description="Precio por persona mínimo"),
    precio_max: Decimal | None = Query(None, ge=0, description="Precio por persona máximo (0 = solo gratuitas)"),
    db: Session = Depends(get_db),
) -> PaginaExperiencias:
    """Público: experiencias activas que cumplen los filtros, de la más reciente a la más antigua."""
    if precio_min is not None and precio_max is not None and precio_min > precio_max:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"campo": "precio_max", "mensaje": "El precio máximo debe ser mayor o igual al mínimo"},
        )

    filtros = [Experiencia.estado == EstadoExperiencia.activo]
    if localidad and localidad.strip():
        buscado = " ".join(localidad.split()).lower().translate(QUITAR_TILDES)
        filtros.append(normalizar_localidad(Experiencia.localidad).contains(buscado, autoescape=True))
    if tipo:
        filtros.append(Experiencia.tipo.in_(tipo))
    if precio_min is not None:
        filtros.append(Experiencia.precio_por_persona >= precio_min)
    if precio_max is not None:
        filtros.append(Experiencia.precio_por_persona <= precio_max)

    total = db.scalar(select(func.count()).select_from(Experiencia).where(*filtros)) or 0
    consulta = (
        select(Experiencia)
        .where(*filtros)
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


@router.get("/localidades", response_model=list[str])
def localidades_catalogo(db: Session = Depends(get_db)) -> list[str]:
    """Público: localidades con experiencias activas, para sugerirlas en el filtro del catálogo."""
    consulta = (
        select(Experiencia.localidad)
        .where(Experiencia.estado == EstadoExperiencia.activo)
        .distinct()
        .order_by(Experiencia.localidad)
    )
    return list(db.scalars(consulta))


@router.post("", response_model=ExperienciaPublica, status_code=status.HTTP_201_CREATED)
def crear_experiencia(
    datos: ExperienciaCrear,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Experiencia:
    verificar_emprendimiento_propio(datos.emprendimiento_id, usuario, db)
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


@router.get("/{experiencia_id}", response_model=ExperienciaDetalle)
def obtener_experiencia(
    experiencia_id: int,
    usuario: Usuario | None = Depends(get_usuario_opcional),
    db: Session = Depends(get_db),
) -> Experiencia:
    """Público: detalle de una experiencia activa. Las pausadas solo las ve su dueño (para revisarlas)."""
    experiencia = db.get(
        Experiencia,
        experiencia_id,
        options=[joinedload(Experiencia.emprendimiento), selectinload(Experiencia.fotos)],
    )
    es_dueno = experiencia is not None and usuario is not None and experiencia.emprendimiento.usuario_id == usuario.id
    if experiencia is None or (experiencia.estado != EstadoExperiencia.activo and not es_dueno):
        # Una pausada responde igual que una inexistente, para no revelar que existe
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Experiencia no encontrada")
    return experiencia


@router.put("/{experiencia_id}", response_model=ExperienciaPublica)
def editar_experiencia(
    experiencia_id: int,
    datos: ExperienciaEditar,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Experiencia:
    """Reemplaza todos los datos de la experiencia. Puede moverse a otro emprendimiento del mismo dueño."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    if datos.emprendimiento_id != experiencia.emprendimiento_id:
        verificar_emprendimiento_propio(datos.emprendimiento_id, usuario, db)
    for campo, valor in datos.model_dump().items():
        setattr(experiencia, campo, valor)
    db.commit()
    db.refresh(experiencia)
    return experiencia


@router.patch("/{experiencia_id}/estado", response_model=ExperienciaPublica)
def cambiar_estado_experiencia(
    experiencia_id: int,
    datos: ExperienciaEstado,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> Experiencia:
    """Pausa o reanuda la experiencia. Las pausadas no aparecen en el catálogo público."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    experiencia.estado = datos.estado
    db.commit()
    db.refresh(experiencia)
    return experiencia


@router.delete("/{experiencia_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_experiencia(
    experiencia_id: int,
    usuario: Usuario = Depends(solo_anfitrion),
    db: Session = Depends(get_db),
) -> None:
    """Borra la experiencia junto con su galería (filas y archivos). No se puede deshacer."""
    experiencia = obtener_propia(experiencia_id, usuario, db)
    urls = [f.url for f in experiencia.fotos]
    db.delete(experiencia)
    db.commit()
    # Los archivos se borran después del commit: si este falla, las fotos siguen intactas
    for url in urls:
        borrar_foto_experiencia(url)


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
