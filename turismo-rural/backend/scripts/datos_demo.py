"""
Carga un conjunto completo de cuentas de prueba: anfitriones con sus emprendimientos, experiencias,
fotos y fechas disponibles, y visitantes con reservas en todos los estados (y sus pagos).

    docker compose exec backend python -m scripts.datos_demo

Las credenciales están en CREDENCIALES_PRUEBA.txt (en la raíz del proyecto). Todas las cuentas usan la
contraseña CONTRASENA y correos @example.com, un dominio reservado que nunca entrega correo real.

Se puede ejecutar varias veces y en cualquier ordenador: primero borra las cuentas de prueba anteriores
(con todo lo suyo) y luego las vuelve a crear. Las fechas se calculan desde el día en que se ejecuta,
así que siempre hay fechas disponibles hacia adelante. No toca las demás cuentas.
"""

import secrets
import sys
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import or_, select

from app.core.archivos import (
    borrar_foto_emprendimiento,
    borrar_foto_experiencia,
    guardar_foto_emprendimiento,
    guardar_foto_experiencia,
    url_foto_emprendimiento,
)
from app.core.db import SessionLocal
from app.core.fechas import hoy
from app.core.security import hash_password
from app.models import (
    DisponibilidadExperiencia,
    Emprendimiento,
    EstadoPago,
    EstadoReserva,
    Experiencia,
    FotoExperiencia,
    MetodoPago,
    Pago,
    Reserva,
    RolUsuario,
    TipoExperiencia,
    Usuario,
)
from app.models.emprendimiento import COLOR_PRIMARIO_POR_DEFECTO, COLOR_SECUNDARIO_POR_DEFECTO
from app.models.reserva import ESTADOS_ACTIVOS
from app.schemas.emprendimiento import Bloques, EmprendimientoEditar, EmprendimientoPersonalizar, RedesContacto
from app.schemas.experiencia import ExperienciaCrear
from app.schemas.validadores import validar_telefono
from scripts.datos_ejemplo import EMPRENDIMIENTO as LOS_COIGUES
from scripts.datos_ejemplo import EXPERIENCIAS as EXPERIENCIAS_LOS_COIGUES
from scripts.datos_ejemplo import PERSONALIZACION as PERSONALIZACION_LOS_COIGUES
from scripts.datos_ejemplo import foto_procesada

CONTRASENA = "Rural2026"
FOTOS_POR_EXPERIENCIA = 3
# Días hacia adelante que se abren: los hospedajes todas las noches, el resto según su calendario
DIAS_ABIERTOS = 75

# Días de la semana en que sale cada experiencia que no es hospedaje (0 = lunes); se reparten en orden
CALENDARIOS = [(5, 6), (1, 3, 5), (0, 1, 2, 3, 4, 5, 6), (2, 4, 5, 6), (3, 5, 6)]


@dataclass
class DatosEmprendimiento:
    datos: EmprendimientoEditar
    personalizacion: EmprendimientoPersonalizar
    # (tipo, título, descripción, precio CLP, capacidad, localidad, coordenadas o None, estado, paleta de fotos)
    experiencias: list[tuple]
    paletas: tuple[str, str] = ("dia", "atardecer")


@dataclass
class Cuenta:
    clave: str
    nombre: str
    correo: str | None
    telefono: str | None
    rol: RolUsuario
    emprendimientos: list[DatosEmprendimiento] = field(default_factory=list)


def bloques(gastronomia: str | None = None, festividades: str | None = None, normas: str | None = None) -> Bloques:
    return Bloques.model_validate(
        {
            clave: {"activo": True, "contenido": contenido}
            for clave, contenido in (("gastronomia", gastronomia), ("festividades", festividades), ("normas_visita", normas))
            if contenido
        }
    )


RAYEN_MAPU = DatosEmprendimiento(
    datos=EmprendimientoEditar(
        nombre="Agroturismo Rayén Mapu",
        telefono_contacto="+56 9 5550 1102",
        direccion="Camino a Tenaún km 4, sector San Juan",
        localidad="Dalcahue",
        descripcion=(
            "Campo familiar frente al canal de Dalcahue, con ovejas, papas nativas y un fogón donde siempre "
            "hay mate. Recibimos a quienes quieren conocer Chiloé desde adentro: su cocina, su lana y su mar."
        ),
        historia=(
            "Juan Carlos y su madre, la señora Elba, empezaron recibiendo mochileros en 2009. Hoy la casa sigue "
            "siendo la misma, pero se sumaron el taller de tejido y el bote con el que salimos a las islas."
        ),
        redes=RedesContacto(instagram="rayenmapuchiloe", facebook="rayenmapu.dalcahue", whatsapp="+56 9 5550 1102"),
    ),
    personalizacion=EmprendimientoPersonalizar(
        color_primario="#2c5d73",
        color_secundario="#8a5a3c",
        relato_comunidad=(
            "En Dalcahue las familias todavía se juntan para la minga: mover una casa, sembrar o cosechar entre "
            "todos. La feria artesanal y la iglesia patrimonial son el corazón del pueblo."
        ),
        bloques=bloques(
            gastronomia="Curanto al hoyo, milcao, chapalele y licor de murta. Las papas son nativas, de nuestra huerta.",
            festividades="En febrero, la Fiesta Costumbrista de Dalcahue; en septiembre, la minga de tiradura de casa.",
            normas="El clima cambia rápido: trae impermeable aunque haya sol. En el bote, el chaleco salvavidas es obligatorio.",
        ),
    ),
    experiencias=[
        (
            "gastronomia",
            "Curanto al hoyo con la familia",
            "Preparamos juntos un curanto tradicional: cavamos el hoyo, calentamos las piedras y cubrimos con "
            "nalca los mariscos, carnes, milcaos y chapaleles.\n\nDuración: 4 horas.\nIncluye el almuerzo completo "
            "y licor de murta.",
            Decimal("24000"),
            15,
            "Dalcahue",
            (-42.3786, -73.6506),
            "activo",
            "calido",
        ),
        (
            "acuatica",
            "Navegación a la isla Quinchao",
            "Cruzamos el canal en bote hasta Achao para visitar su iglesia de madera, la más antigua de Chiloé, "
            "y ver toninas y cormoranes en el camino.\n\nDuración: 5 horas.\nIncluye chaleco salvavidas y "
            "colación a bordo.",
            Decimal("30000"),
            8,
            "Dalcahue",
            (-42.4706, -73.4917),
            "activo",
            "rio",
        ),
        (
            "artesania",
            "Taller de hilado y tejido en lana de oveja",
            "La señora Elba enseña a escarmenar, hilar con huso y teñir con plantas del campo. Al final tejes "
            "una pieza pequeña en el telar de la casa.\n\nDuración: 3 horas. Materiales incluidos.",
            Decimal("15000"),
            6,
            "Dalcahue",
            None,
            "activo",
            "calido",
        ),
        (
            "cultural",
            "Ruta de las iglesias patrimoniales",
            "Recorrido en furgón por cuatro iglesias de madera declaradas Patrimonio de la Humanidad: Dalcahue, "
            "Tenaún, Castro y Nercón, con relatos de cómo se construyeron en minga.\n\nDuración: 6 horas.",
            Decimal("12000"),
            12,
            "Castro",
            (-42.4808, -73.7622),
            "activo",
            "dia",
        ),
        (
            "hospedaje",
            "Palafito sobre el canal",
            "Habitación en un palafito restaurado, con ventanal sobre el agua y estufa a leña. Con la marea alta "
            "el mar pasa bajo la casa.\n\nPara hasta tres personas. Llegada desde las 15:00, salida hasta las 11:00.\n"
            "Incluye desayuno con pan amasado y mermelada de murta.",
            Decimal("32000"),
            3,
            "Castro",
            (-42.4752, -73.7689),
            "activo",
            "rio",
        ),
    ],
    paletas=("rio", "dia"),
)

CIELO_DE_ELQUI = DatosEmprendimiento(
    datos=EmprendimientoEditar(
        nombre="Domos Cielo de Elqui",
        telefono_contacto="+56 9 5550 1203",
        direccion="Calle Los Carrera 120, Pisco Elqui",
        localidad="Pisco Elqui",
        descripcion=(
            "Domos geodésicos en la ladera del valle, con techo transparente para dormir mirando las estrellas. "
            "Uno de los cielos más limpios del planeta, a pasos del río Claro."
        ),
        historia="Marcela dejó la ciudad en 2017 para volver al valle de sus abuelos y levantar los domos con sus propias manos.",
        redes=RedesContacto(instagram="cielodeelqui", sitio_web="https://cielodeelqui.example.com"),
    ),
    personalizacion=EmprendimientoPersonalizar(
        color_primario="#3b3f7a",
        color_secundario="#c27a3a",
        relato_comunidad=(
            "El valle de Elqui vive del pisco, la fruta y el turismo. Sus pueblos protegen la oscuridad del cielo: "
            "las luces de las calles apuntan hacia abajo para no tapar las estrellas."
        ),
        bloques=bloques(
            gastronomia="Pan de rescoldo, queso de cabra y papayas del valle. Cocina solar los fines de semana.",
            normas="De noche, usa solo linternas de luz roja para no encandilar a los demás observadores.",
        ),
    ),
    experiencias=[
        (
            "avistamiento",
            "Observación astronómica con telescopio",
            "Sesión nocturna con telescopio de 10 pulgadas: planetas, nebulosas y la Vía Láctea a simple vista. "
            "Te enseñamos a reconocer las constelaciones del cielo austral.\n\nDuración: 2 horas.\nIncluye "
            "chocolate caliente y mantas.",
            Decimal("20000"),
            12,
            "Pisco Elqui",
            (-30.1247, -70.4906),
            "activo",
            "noche",
        ),
        (
            "cabalgata",
            "Cabalgata al valle de Cochiguaz",
            "Subimos a caballo por el cajón del río Cochiguaz, entre cerros áridos y quebradas verdes.\n\n"
            "Duración: 4 horas. Edad mínima: 10 años.\nIncluye almuerzo campestre.",
            Decimal("30000"),
            6,
            "Paihuano",
            (-30.1450, -70.4100),
            "activo",
            "calido",
        ),
        (
            "hospedaje",
            "Domo con techo estrellado",
            "Domo para dos personas con cama king, baño privado y techo transparente sobre la cama.\n\n"
            "Llegada desde las 16:00, salida hasta las 12:00.\nIncluye desayuno con frutas del valle.",
            Decimal("45000"),
            2,
            "Pisco Elqui",
            (-30.1260, -70.4920),
            "activo",
            "noche",
        ),
    ],
    paletas=("noche", "calido"),
)

LAS_HIGUERAS = DatosEmprendimiento(
    datos=EmprendimientoEditar(
        nombre="Huerta Las Higueras",
        telefono_contacto="+56 9 5550 1204",
        direccion="Parcela 14, sector Peralillo",
        localidad="Vicuña",
        descripcion="Huerta orgánica con higueras, papayos y parronales, donde se cosecha y se cocina lo del día.",
        historia=None,
        redes=RedesContacto(instagram="huertalashigueras"),
    ),
    personalizacion=EmprendimientoPersonalizar(
        color_primario="#5a7a2e", color_secundario="#a3542f", relato_comunidad=None, bloques=bloques()
    ),
    experiencias=[
        (
            "agroturismo",
            "Cosecha de fruta en la huerta",
            "Recorremos la huerta y cosechas higos, papayas o uvas según la temporada. Te llevas una canasta.\n\n"
            "Ideal para familias. Duración: 2 horas.",
            Decimal("0"),
            20,
            "Vicuña",
            (-30.0319, -70.7081),
            "activo",
            "dia",
        ),
        (
            "gastronomia",
            "Taller de dulces y mermeladas de papaya",
            "Preparamos papayas en almíbar y mermelada de higos en la cocina de la huerta. Te llevas dos frascos.\n\n"
            "Duración: 2 horas y media.",
            Decimal("10000"),
            10,
            "Vicuña",
            None,
            "activo",
            "calido",
        ),
    ],
    paletas=("dia", "calido"),
)

LAGO_RANCO = DatosEmprendimiento(
    datos=EmprendimientoEditar(
        nombre="Kayak y Campo Lago Ranco",
        telefono_contacto="+56 9 5550 1305",
        direccion="Ruta T-55 km 12, Llifén",
        localidad="Futrono",
        descripcion=(
            "Base de kayak y pesca a orillas del lago Ranco, con vista a la isla Huapi y la cordillera. Salimos "
            "con grupos pequeños y equipos para principiantes."
        ),
        historia="Pedro fue guía de pesca por veinte años antes de abrir su propia base junto a su hija Catalina.",
        redes=RedesContacto(instagram="kayaklagoranco", tiktok="kayaklagoranco", whatsapp="+56 9 5550 1305"),
    ),
    personalizacion=EmprendimientoPersonalizar(
        color_primario="#1f6f78",
        color_secundario="#9b6b2f",
        relato_comunidad=(
            "En la isla Huapi vive una comunidad mapuche-huilliche que cada año celebra el nguillatun. Las "
            "familias de la orilla combinan la ganadería con la pesca y el turismo."
        ),
        bloques=bloques(
            festividades="En enero, la Semana Futronina; en marzo, el nguillatun de isla Huapi (solo con invitación).",
            normas="Respeta las zonas de pesca con devolución. No se navega con viento sur fuerte.",
        ),
    ),
    experiencias=[
        (
            "acuatica",
            "Kayak al atardecer por el lago Ranco",
            "Remada tranquila por la orilla del lago hasta una playa de arena volcánica, para ver caer el sol tras "
            "la cordillera.\n\nNo se necesita experiencia. Duración: 3 horas.\nIncluye kayak doble, chaleco y "
            "traje seco.",
            Decimal("28000"),
            8,
            "Futrono",
            (-40.1306, -72.3936),
            "activo",
            "atardecer",
        ),
        (
            "pesca",
            "Pesca de trucha desde bote",
            "Jornada de pesca con señuelo y mosca en las bahías del lago, con guía y bote a motor.\n\n"
            "Duración: 6 horas.\nIncluye equipo y almuerzo. Licencia de pesca no incluida.",
            Decimal("40000"),
            3,
            "Lago Ranco",
            (-40.3167, -72.4833),
            "activo",
            "rio",
        ),
        (
            "senderismo",
            "Sendero al salto del río Caunahue",
            "Caminata fácil entre bosque valdiviano hasta una cascada de 20 metros.\n\nDuración: 3 horas. Apta "
            "para niños desde 7 años.",
            Decimal("15000"),
            12,
            "Futrono",
            (-40.1520, -72.2400),
            "activo",
            "dia",
        ),
        (
            "cultural",
            "Visita a la comunidad de isla Huapi",
            "Cruzamos a la isla para compartir con una familia huilliche: su huerta, su ruka y su historia.\n\n"
            "Duración: 5 horas. Incluye traslado en bote y almuerzo.",
            Decimal("18000"),
            10,
            "Futrono",
            (-40.2167, -72.3500),
            "activo",
            "amanecer",
        ),
        (
            "senderismo",
            "Caminata nocturna de luciérnagas",
            "Salida nocturna por el bosque para ver luciérnagas y escuchar a los anfibios del humedal.\n\n"
            "Pausada hasta la próxima temporada (diciembre).",
            Decimal("12000"),
            10,
            "Futrono",
            None,
            # Pausada: no aparece en el catálogo
            "pausado",
            "noche",
        ),
    ],
    paletas=("atardecer", "rio"),
)

LICAN_RAY = DatosEmprendimiento(
    datos=EmprendimientoEditar(
        nombre="Cabañas Lican Ray",
        telefono_contacto="+56 9 5550 1406",
        direccion="Calle Urrutia 455, Lican Ray",
        localidad="Lican Ray",
        descripcion="Cabañas junto al lago Calafquén. Pronto publicaremos nuestras experiencias.",
        historia=None,
        redes=RedesContacto(),
    ),
    personalizacion=EmprendimientoPersonalizar(
        color_primario=COLOR_PRIMARIO_POR_DEFECTO,
        color_secundario=COLOR_SECUNDARIO_POR_DEFECTO,
        relato_comunidad=None,
        bloques=bloques(),
    ),
    # Anfitrión recién registrado: todavía sin experiencias
    experiencias=[],
)

LOS_COIGUES_DEMO = DatosEmprendimiento(
    datos=EmprendimientoEditar.model_validate({**LOS_COIGUES.model_dump(), "telefono_contacto": "+56 9 5550 1001"}),
    personalizacion=PERSONALIZACION_LOS_COIGUES,
    experiencias=EXPERIENCIAS_LOS_COIGUES,
)

CUENTAS = [
    Cuenta("rosa", "Rosa Antinao", "rosa.antinao@example.com", "+56 9 5550 1001", RolUsuario.anfitrion, [LOS_COIGUES_DEMO]),
    Cuenta("juan", "Juan Carlos Millalonco", "juancarlos.millalonco@example.com", "+56 9 5550 1102", RolUsuario.anfitrion, [RAYEN_MAPU]),
    Cuenta("marcela", "Marcela Soto", "marcela.soto@example.com", None, RolUsuario.anfitrion, [CIELO_DE_ELQUI, LAS_HIGUERAS]),
    Cuenta("pedro", "Pedro Hernández", "pedro.hernandez@example.com", "+56 9 5550 1305", RolUsuario.anfitrion, [LAGO_RANCO]),
    Cuenta("luis", "Luis Paillalef", "luis.paillalef@example.com", None, RolUsuario.anfitrion, [LICAN_RAY]),
    Cuenta("camila", "Camila Rojas", "camila.rojas@example.com", "+56 9 5550 2001", RolUsuario.visitante),
    Cuenta("diego", "Diego Fuentes", "diego.fuentes@example.com", None, RolUsuario.visitante),
    Cuenta("valentina", "Valentina Muñoz", "valentina.munoz@example.com", None, RolUsuario.visitante),
    # Registrado solo con teléfono: inicia sesión con el número y da un correo al reservar
    Cuenta("sebastian", "Sebastián Torres", None, "+56 9 5550 2004", RolUsuario.visitante),
]

# Correo de contacto de las reservas de las cuentas sin correo
CORREO_RESERVAS = {"sebastian": "sebastian.torres@example.com"}

# (visitante, experiencia, cuándo, personas, noches, estado, método de pago, pago en línea)
# "cuándo": n >= 0 es el n-ésimo día abierto de la experiencia desde hoy; n < 0 son días en el pasado
RESERVAS = [
    ("camila", "Cabalgata por el valle del río Maichín", 1, 2, 1, "confirmada", "transferencia", "rechazado"),
    ("camila", "Palafito sobre el canal", 3, 2, 3, "pendiente", "tarjeta", None),
    ("camila", "Observación astronómica con telescopio", 0, 3, 1, "pagada", "en_linea", "aprobado"),
    ("camila", "Sendero al mirador del volcán Lanín", -20, 2, 1, "pagada", "efectivo", None),
    ("camila", "Kayak al atardecer por el lago Ranco", 2, 2, 1, "cancelada", "tarjeta", None),
    # Ocupa toda la capacidad: el día queda agotado
    ("diego", "Pesca con mosca en el río Trancura", 0, 4, 1, "confirmada", "efectivo", None),
    ("diego", "Curanto al hoyo con la familia", 1, 5, 1, "pendiente", "transferencia", None),
    ("diego", "Un día en la huerta y el invernadero", 2, 3, 1, "confirmada", None, None),
    ("diego", "Visita a la comunidad de isla Huapi", 0, 2, 1, "rechazada", "transferencia", None),
    ("diego", "Domo con techo estrellado", -40, 2, 2, "pagada", "en_linea", "aprobado"),
    ("sebastian", "Pesca de trucha desde bote", 1, 1, 1, "pendiente", "efectivo", None),
    ("sebastian", "Ruta de las iglesias patrimoniales", 0, 2, 1, "pagada", "transferencia", None),
    ("sebastian", "Cocina de fogón: catuto y sopaipillas", 0, 4, 1, "pendiente", "efectivo", None),
]


def borrar_cuentas_anteriores(db) -> tuple[list[str], list[str | None]]:
    """Borra las cuentas de prueba (y en cascada todo lo suyo); devuelve las fotos para borrar tras el commit."""
    correos = [c.correo for c in CUENTAS if c.correo]
    telefonos = [validar_telefono(c.telefono) for c in CUENTAS if c.telefono]
    anteriores = db.scalars(select(Usuario).where(or_(Usuario.correo.in_(correos), Usuario.telefono.in_(telefonos)))).all()
    fotos_experiencias: list[str] = []
    fotos_emprendimientos: list[str | None] = []
    for usuario in anteriores:
        for emprendimiento in usuario.emprendimientos:
            fotos_emprendimientos += [emprendimiento.foto_perfil, emprendimiento.portada_url]
            for experiencia in emprendimiento.experiencias:
                fotos_experiencias += [f.url for f in experiencia.fotos]
        # Las reservas y pagos de estas cuentas (o en sus experiencias) se borran en cascada en la base de datos
        db.delete(usuario)
    db.flush()
    if anteriores:
        print(f"Cuentas de prueba anteriores borradas: {len(anteriores)}")
    return fotos_experiencias, fotos_emprendimientos


def dias_abiertos(experiencia: Experiencia, n: int) -> list:
    """Días que abre la experiencia: los hospedajes todas las noches, el resto según su calendario."""
    if experiencia.tipo == TipoExperiencia.hospedaje:
        return [hoy() + timedelta(days=i) for i in range(DIAS_ABIERTOS)]
    semana = CALENDARIOS[n % len(CALENDARIOS)]
    return [d for d in (hoy() + timedelta(days=i) for i in range(DIAS_ABIERTOS)) if d.weekday() in semana]


def crear_emprendimiento(db, usuario: Usuario, datos: DatosEmprendimiento, semilla: int, archivos: list[str]) -> list[Experiencia]:
    emprendimiento = Emprendimiento(
        **datos.datos.model_dump(exclude={"redes"}),
        redes=datos.datos.redes.model_dump(exclude_none=True),
        color_primario=datos.personalizacion.color_primario,
        color_secundario=datos.personalizacion.color_secundario,
        relato_comunidad=datos.personalizacion.relato_comunidad,
        bloques=datos.personalizacion.bloques.model_dump(),
        usuario_id=usuario.id,
    )
    perfil = guardar_foto_emprendimiento(foto_procesada(semilla, datos.paletas[0], 800, 800), "webp")
    portada = guardar_foto_emprendimiento(foto_procesada(semilla + 1, datos.paletas[1], 1800, 600), "webp")
    archivos += [url_foto_emprendimiento(perfil), url_foto_emprendimiento(portada)]
    emprendimiento.foto_perfil = perfil
    emprendimiento.portada_url = url_foto_emprendimiento(portada)
    db.add(emprendimiento)
    db.flush()

    experiencias = []
    for n, (tipo, titulo, descripcion, precio, capacidad, localidad, coords, estado, paleta) in enumerate(datos.experiencias):
        valida = ExperienciaCrear(
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
        experiencia = Experiencia(**valida.model_dump())
        for orden in range(FOTOS_POR_EXPERIENCIA):
            url = guardar_foto_experiencia(foto_procesada(semilla + 100 * (n + 1) + orden, paleta))
            archivos.append(url)
            experiencia.fotos.append(FotoExperiencia(url=url, orden=orden))
        db.add(experiencia)
        experiencias.append(experiencia)
    db.flush()
    print(f"  {datos.datos.nombre}: {len(experiencias)} experiencias")
    return experiencias


def main() -> int:
    hash_contrasena = hash_password(CONTRASENA)
    archivos_nuevos: list[str] = []

    with SessionLocal() as db:
        fotos_experiencias, fotos_emprendimientos = borrar_cuentas_anteriores(db)
        try:
            usuarios: dict[str, Usuario] = {}
            experiencias: dict[str, Experiencia] = {}
            calendario: dict[int, list] = {}

            for k, cuenta in enumerate(CUENTAS):
                usuario = Usuario(
                    nombre=cuenta.nombre,
                    correo=cuenta.correo,
                    telefono=validar_telefono(cuenta.telefono) if cuenta.telefono else None,
                    contrasena_hash=hash_contrasena,
                    rol=cuenta.rol,
                )
                db.add(usuario)
                db.flush()
                usuarios[cuenta.clave] = usuario
                for m, datos in enumerate(cuenta.emprendimientos):
                    for n, experiencia in enumerate(crear_emprendimiento(db, usuario, datos, 10_000 * k + 1_000 * m, archivos_nuevos)):
                        experiencias[experiencia.titulo] = experiencia
                        calendario[experiencia.id] = dias_abiertos(experiencia, n)

            # Reservas: las activas a futuro descuentan cupos de sus días, como al reservar desde la app
            ocupados: dict[tuple[int, object], int] = {}
            ahora = datetime.now(timezone.utc)
            for visitante, titulo, cuando, personas, noches, estado, metodo, pago in RESERVAS:
                experiencia = experiencias[titulo]
                fecha = calendario[experiencia.id][cuando] if cuando >= 0 else hoy() + timedelta(days=cuando)
                estado = EstadoReserva(estado)
                reserva = Reserva(
                    visitante_id=usuarios[visitante].id,
                    experiencia_id=experiencia.id,
                    fecha=fecha,
                    noches=noches,
                    personas=personas,
                    precio_por_persona=experiencia.precio_por_persona,
                    total=experiencia.precio_por_persona * personas * noches,
                    estado=estado,
                    metodo_pago=MetodoPago(metodo) if metodo else None,
                    correo=usuarios[visitante].correo or CORREO_RESERVAS[visitante],
                    # Las reservas pasadas se hicieron unas semanas antes de la visita
                    fecha_creacion=min(ahora, datetime.combine(fecha, time(12), timezone.utc) - timedelta(days=14)),
                )
                db.add(reserva)
                db.flush()
                if estado in ESTADOS_ACTIVOS and cuando >= 0:
                    for dia in reserva.dias:
                        ocupados[(experiencia.id, dia)] = ocupados.get((experiencia.id, dia), 0) + personas
                if pago:
                    cobro = Pago(reserva_id=reserva.id, proveedor="simulado", monto=reserva.total, estado=EstadoPago(pago))
                    db.add(cobro)
                    db.flush()
                    cobro.id_cobro = f"sim-{cobro.id}"
                    cobro.id_transaccion = f"sim-{secrets.token_hex(6)}"

            for experiencia in experiencias.values():
                for dia in calendario[experiencia.id]:
                    cupos = experiencia.capacidad_maxima - ocupados.get((experiencia.id, dia), 0)
                    assert cupos >= 0, f"Sobreventa en {experiencia.titulo} el {dia}"
                    db.add(DisponibilidadExperiencia(experiencia_id=experiencia.id, fecha=dia, cupos=cupos))

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
    for url in fotos_experiencias:
        borrar_foto_experiencia(url)
    for nombre in fotos_emprendimientos:
        borrar_foto_emprendimiento(nombre)

    print(f"\nListo: {len(CUENTAS)} cuentas, {len(experiencias)} experiencias y {len(RESERVAS)} reservas.")
    print(f"Contraseña de todas las cuentas: {CONTRASENA}  (detalle en CREDENCIALES_PRUEBA.txt)")
    for cuenta in CUENTAS:
        print(f"  {cuenta.rol.value:<10} {cuenta.nombre:<24} {cuenta.correo or validar_telefono(cuenta.telefono)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
