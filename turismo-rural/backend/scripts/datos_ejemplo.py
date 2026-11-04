"""
Crea un emprendimiento con experiencias de ejemplo para la cuenta de un anfitrión.

    docker compose exec backend python -m scripts.datos_ejemplo
    docker compose exec backend python -m scripts.datos_ejemplo --correo otra@cuenta.cl
    docker compose exec backend python -m scripts.datos_ejemplo --borrar-experiencias-existentes

Se puede ejecutar varias veces: antes de crear, borra el emprendimiento de ejemplo anterior de esa
cuenta (con sus experiencias y fotos). Con --borrar-experiencias-existentes borra además TODAS las
experiencias de la base de datos, de cualquier cuenta.

Las fotos son paisajes ilustrados generados con Pillow (sin derechos de terceros) y pasan por el
mismo proceso de compresión que las que suben los anfitriones.
"""

import argparse
import io
import random
import sys
from decimal import Decimal

from PIL import Image, ImageColor, ImageDraw, ImageFilter
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.archivos import (
    borrar_foto_emprendimiento,
    borrar_foto_experiencia,
    comprimir_imagen,
    guardar_foto_emprendimiento,
    guardar_foto_experiencia,
    url_foto_emprendimiento,
)
from app.core.db import SessionLocal
from app.models import Emprendimiento, Experiencia, FotoExperiencia, RolUsuario, Usuario
from app.schemas.emprendimiento import Bloques, EmprendimientoEditar, EmprendimientoPersonalizar, RedesContacto
from app.schemas.experiencia import ExperienciaCrear

CORREO_POR_DEFECTO = "anfitrion@gmail.com"
NOMBRE_EMPRENDIMIENTO = "Refugio Rural Los Coigües"

# Curarrehue y Pucón (Región de La Araucanía)
CURARREHUE = (-39.3589, -71.5878)
PUCON = (-39.2726, -71.9773)

EMPRENDIMIENTO = EmprendimientoEditar(
    nombre=NOMBRE_EMPRENDIMIENTO,
    telefono_contacto="+56 9 1234 5678",
    direccion="Camino a Reigolil km 8, sector Maichín",
    localidad="Curarrehue",
    descripcion=(
        "Refugio familiar a orillas del río Maichín, rodeado de bosque nativo y con vista al volcán Lanín. "
        "Recibimos grupos pequeños para compartir el día a día del campo: la huerta, los animales, "
        "la cocina de fogón y los senderos que conocemos desde niños."
    ),
    historia=(
        "La familia Antinao trabaja esta tierra hace cuatro generaciones. En 2015 abrimos las puertas "
        "del refugio para que más personas conocieran el valle sin apuro, como lo vivimos nosotros."
    ),
    redes=RedesContacto(instagram="refugioloscoigues", whatsapp="+56 9 1234 5678"),
)

PERSONALIZACION = EmprendimientoPersonalizar(
    color_primario="#2f6b4f",
    color_secundario="#b5652d",
    relato_comunidad=(
        "Curarrehue es una comuna cordillerana donde la cultura mapuche sigue viva en la lengua, la "
        "comida y las ceremonias. Aquí las familias combinan la agricultura a pequeña escala con el "
        "turismo, cuidando los bosques y los ríos que nos dan de comer."
    ),
    bloques=Bloques.model_validate(
        {
            "gastronomia": {
                "activo": True,
                "contenido": "Pan amasado, catuto con miel, sopaipillas y cazuela de ave de campo. "
                "Todo con productos de nuestra huerta y de vecinos del valle.",
            },
            "festividades": {
                "activo": True,
                "contenido": "En junio celebramos el We Tripantu (año nuevo mapuche) y en febrero la "
                "Muestra Costumbrista de Curarrehue.",
            },
            "normas_visita": {
                "activo": True,
                "contenido": "Llega con ropa cómoda y zapatos cerrados. No dejes basura en los senderos "
                "y pide permiso antes de fotografiar a las personas.",
            },
        }
    ),
)

# (tipo, título, descripción, precio CLP, capacidad, localidad, coordenadas o None, estado, paleta de fotos)
EXPERIENCIAS = [
    (
        "senderismo",
        "Sendero al mirador del volcán Lanín",
        "Caminata de dificultad media por bosque de coigües y lengas hasta un mirador natural con vista "
        "al volcán Lanín.\n\nDuración: 5 horas (ida y vuelta).\nIncluye: guía local, colación y bastones.\n"
        "Lleva: agua, cortaviento y protector solar.",
        Decimal("25000"),
        10,
        "Curarrehue",
        (-39.3712, -71.5541),
        "activo",
        "dia",
    ),
    (
        "cabalgata",
        "Cabalgata por el valle del río Maichín",
        "Recorrido a caballo por potreros y vados del río Maichín, con parada para tomar mate junto al "
        "fogón.\n\nNo se necesita experiencia: elegimos un caballo manso para cada visitante.\n"
        "Edad mínima: 8 años. Duración: 3 horas.",
        Decimal("35000"),
        6,
        "Curarrehue",
        (-39.3478, -71.5702),
        "activo",
        "atardecer",
    ),
    (
        "gastronomia",
        "Cocina de fogón: catuto y sopaipillas",
        "Aprende a preparar catuto (pan de trigo mote), sopaipillas y pebre en la cocina de fogón de la "
        "familia. Al final compartimos la mesa con lo que cocinamos.\n\nDuración: 2 horas y media.\n"
        "Avísanos si tienes alguna restricción alimentaria.",
        Decimal("18000"),
        12,
        "Curarrehue",
        CURARREHUE,
        "activo",
        "calido",
    ),
    (
        "agroturismo",
        "Un día en la huerta y el invernadero",
        "Acompáñanos en las tareas de la mañana: cosechar, regar el invernadero y alimentar a las "
        "gallinas. Te llevas una bolsa con verduras de la temporada.\n\nIdeal para familias con niños.",
        Decimal("0"),
        15,
        "Curarrehue",
        None,
        "activo",
        "dia",
    ),
    (
        "artesania",
        "Taller de telar mapuche",
        "Doña Rosa enseña los primeros pasos del witral (telar mapuche): preparar la urdimbre, tejer una "
        "trarilonko (faja) sencilla y conocer el significado de sus diseños.\n\nDuración: 3 horas.\n"
        "Incluye materiales; te llevas tu tejido.",
        Decimal("22000"),
        6,
        "Curarrehue",
        (-39.3601, -71.5893),
        "activo",
        "calido",
    ),
    (
        "pesca",
        "Pesca con mosca en el río Trancura",
        "Salida de pesca con devolución en los pozones del río Trancura, con un guía que te enseña a "
        "lanzar la mosca desde cero.\n\nTemporada: noviembre a abril.\nIncluye equipo completo y "
        "waders. Licencia de pesca no incluida.",
        Decimal("45000"),
        4,
        "Pucón",
        (-39.2862, -71.7764),
        "activo",
        "rio",
    ),
    (
        "avistamiento",
        "Observación de aves al amanecer",
        "Salimos antes del amanecer a los humedales del valle para ver y escuchar al chucao, el "
        "hued-hued y el carpintero negro.\n\nPrestamos binoculares. Duración: 3 horas, con desayuno al "
        "regreso.",
        Decimal("15000"),
        8,
        "Pucón",
        PUCON,
        # Pausada para mostrar que no aparece en el catálogo
        "pausado",
        "amanecer",
    ),
]

FOTOS_POR_EXPERIENCIA = 3

# Paletas de los paisajes: cielo (arriba, abajo), sol, capas de montañas (fondo → frente)
PALETAS = {
    "dia": [("#7fb7e8", "#dbeefa"), "#fff6d5", ["#a9c3d6", "#6f9a8a", "#3f7a52", "#24563a"]],
    "atardecer": [("#f2a65a", "#fbe0b4"), "#fff1c7", ["#c08a7a", "#8a6a6a", "#5b4d55", "#2f2f3a"]],
    "amanecer": [("#f7c6c7", "#fdeede"), "#fffaf0", ["#b9b4cf", "#8d8fb3", "#5e6a8f", "#36405e"]],
    "calido": [("#f5c77e", "#fff0d6"), "#fff8e7", ["#c7a77d", "#9a7d55", "#6f5a3a", "#433522"]],
    "rio": [("#8fc6e0", "#e6f4f8"), "#ffffff", ["#9fbfc9", "#5f9294", "#2f6b6b", "#1b4a4d"]],
}


def paisaje(semilla: int, paleta: str, ancho: int = 1600, alto: int = 1000) -> bytes:
    """Ilustración de montañas en capas con cielo degradado y sol; devuelve un PNG."""
    rnd = random.Random(semilla)
    (cielo_arriba, cielo_abajo), color_sol, capas = PALETAS[paleta]

    img = Image.new("RGB", (ancho, alto))
    arriba, abajo = ImageColor.getrgb(cielo_arriba), ImageColor.getrgb(cielo_abajo)
    dibujo = ImageDraw.Draw(img)
    for y in range(alto):
        t = y / alto
        dibujo.line([(0, y), (ancho, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(arriba, abajo)))

    # Sol con halo difuminado
    sx, sy, r = rnd.randint(ancho // 5, ancho * 4 // 5), rnd.randint(alto // 8, alto // 3), rnd.randint(50, 90)
    halo = Image.new("L", (ancho, alto), 0)
    ImageDraw.Draw(halo).ellipse([sx - r * 2.5, sy - r * 2.5, sx + r * 2.5, sy + r * 2.5], fill=90)
    img.paste(Image.new("RGB", (ancho, alto), color_sol), mask=halo.filter(ImageFilter.GaussianBlur(r)))
    ImageDraw.Draw(img).ellipse([sx - r, sy - r, sx + r, sy + r], fill=color_sol)

    # Montañas: cada capa más baja, más oscura y con relieve más suave
    for i, color in enumerate(capas):
        base = alto * (0.42 + 0.14 * i)
        amplitud = alto * (0.22 - 0.04 * i)
        puntos, x, y = [], 0, base - rnd.uniform(0, amplitud)
        while x <= ancho:
            puntos.append((x, y))
            x += rnd.randint(40, 120)
            y = min(max(y + rnd.uniform(-amplitud / 2.5, amplitud / 2.5), base - amplitud), base + amplitud / 3)
        puntos.append((ancho, y))
        capa = ImageDraw.Draw(img)
        capa.polygon([*puntos, (ancho, alto), (0, alto)], fill=color)
        # Árboles en las dos capas del frente
        if i >= len(capas) - 2:
            for _ in range(rnd.randint(12, 30)):
                tx = rnd.randint(0, ancho)
                ty = next((py for px, py in reversed(puntos) if px <= tx), base) + rnd.randint(5, 40)
                h = rnd.randint(30, 70) * (1 + i - (len(capas) - 2))
                capa.polygon([(tx, ty - h), (tx - h // 4, ty), (tx + h // 4, ty)], fill=color)

    salida = io.BytesIO()
    img.save(salida, "PNG")
    return salida.getvalue()


def foto_procesada(semilla: int, paleta: str, ancho: int = 1600, alto: int = 1000) -> bytes:
    """Genera el paisaje y lo pasa por la misma compresión que las fotos subidas (WebP)."""
    comprimida = comprimir_imagen(paisaje(semilla, paleta, ancho, alto))
    assert comprimida is not None
    return comprimida


def borrar_experiencia(db: Session, experiencia: Experiencia) -> list[str]:
    """Marca la experiencia para borrar y devuelve las rutas de sus fotos (se borran tras el commit)."""
    urls = [f.url for f in experiencia.fotos]
    db.delete(experiencia)
    return urls


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--correo", default=CORREO_POR_DEFECTO, help=f"cuenta anfitriona (por defecto {CORREO_POR_DEFECTO})")
    parser.add_argument(
        "--borrar-experiencias-existentes",
        action="store_true",
        help="borra TODAS las experiencias de la base de datos (de cualquier cuenta) antes de crear las de ejemplo",
    )
    args = parser.parse_args()

    with SessionLocal() as db:
        usuario = db.scalar(select(Usuario).where(Usuario.correo == args.correo.lower()))
        if usuario is None:
            print(f"No existe una cuenta con el correo {args.correo}", file=sys.stderr)
            return 1
        if usuario.rol != RolUsuario.anfitrion:
            print(f"La cuenta {args.correo} no es anfitriona (rol: {usuario.rol.value})", file=sys.stderr)
            return 1

        fotos_a_borrar: list[str] = []
        fotos_emprendimiento_a_borrar: list[str | None] = []

        if args.borrar_experiencias_existentes:
            existentes = db.scalars(select(Experiencia).options(selectinload(Experiencia.fotos))).all()
            for experiencia in existentes:
                fotos_a_borrar += borrar_experiencia(db, experiencia)
            print(f"Experiencias existentes borradas: {len(existentes)}")

        # El ejemplo anterior de esta cuenta (si se ejecutó antes) se reemplaza
        anteriores = db.scalars(
            select(Emprendimiento).where(
                Emprendimiento.usuario_id == usuario.id, Emprendimiento.nombre == NOMBRE_EMPRENDIMIENTO
            )
        ).all()
        for anterior in anteriores:
            for experiencia in anterior.experiencias:
                if experiencia in db.deleted:
                    continue
                fotos_a_borrar += [f.url for f in experiencia.fotos]
            fotos_emprendimiento_a_borrar += [anterior.foto_perfil, anterior.portada_url]
            db.delete(anterior)
        db.flush()

        archivos_nuevos: list[str] = []
        try:
            emprendimiento = Emprendimiento(
                **EMPRENDIMIENTO.model_dump(exclude={"redes"}),
                redes=EMPRENDIMIENTO.redes.model_dump(exclude_none=True),
                color_primario=PERSONALIZACION.color_primario,
                color_secundario=PERSONALIZACION.color_secundario,
                relato_comunidad=PERSONALIZACION.relato_comunidad,
                bloques=PERSONALIZACION.bloques.model_dump(),
                usuario_id=usuario.id,
            )
            perfil = guardar_foto_emprendimiento(foto_procesada(1, "dia", 800, 800), "webp")
            portada = guardar_foto_emprendimiento(foto_procesada(2, "atardecer", 1800, 600), "webp")
            archivos_nuevos += [url_foto_emprendimiento(perfil), url_foto_emprendimiento(portada)]
            emprendimiento.foto_perfil = perfil
            emprendimiento.portada_url = url_foto_emprendimiento(portada)
            db.add(emprendimiento)
            db.flush()

            for n, (tipo, titulo, descripcion, precio, capacidad, localidad, coords, estado, paleta) in enumerate(EXPERIENCIAS):
                datos = ExperienciaCrear(
                    emprendimiento_id=emprendimiento.id,
                    tipo=tipo,
                    titulo=titulo,
                    descripcion=descripcion,
                    precio_por_persona=precio,
                    capacidad_maxima=capacidad,
                    localidad=localidad,
                    latitud=coords[0] if coords else None,
                    longitud=coords[1] if coords else None,
                    estado=estado,
                )
                experiencia = Experiencia(**datos.model_dump())
                for orden in range(FOTOS_POR_EXPERIENCIA):
                    url = guardar_foto_experiencia(foto_procesada(100 * n + orden, paleta))
                    archivos_nuevos.append(url)
                    experiencia.fotos.append(FotoExperiencia(url=url, orden=orden))
                db.add(experiencia)
                print(f"  + {titulo} ({estado}, {FOTOS_POR_EXPERIENCIA} fotos)")

            db.commit()
        except Exception:
            db.rollback()
            for url in archivos_nuevos:
                if "/experiencias/" in url:
                    borrar_foto_experiencia(url)
                else:
                    borrar_foto_emprendimiento(url)
            raise

    # Los archivos se borran solo cuando la base de datos ya confirmó los cambios
    for url in fotos_a_borrar:
        borrar_foto_experiencia(url)
    for nombre in fotos_emprendimiento_a_borrar:
        borrar_foto_emprendimiento(nombre)

    print(f"Listo: «{NOMBRE_EMPRENDIMIENTO}» con {len(EXPERIENCIAS)} experiencias para {args.correo}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
