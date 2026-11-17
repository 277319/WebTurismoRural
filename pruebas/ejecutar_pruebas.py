"""
Pruebas de integración y validación (taller Semana 13).

Ejecuta los casos PI-01 a PI-15 contra la app levantada con Docker Compose y guarda la evidencia
de cada uno: peticiones y respuestas HTTP, consultas a PostgreSQL y correos recibidos en Mailpit.
Un caso es PASS solo si la respuesta Y el efecto en el componente conectado son los esperados.

Desde la raíz del repositorio, con la app en marcha (docker compose up -d):

    python pruebas/ejecutar_pruebas.py              # restablece los datos de prueba y ejecuta todo
    python pruebas/ejecutar_pruebas.py --sin-reset  # ejecuta sobre el estado actual

Restablecer = docker compose exec backend python -m scripts.datos_demo, vaciar Mailpit y borrar las
cuentas creadas por PI-14 (correo prueba.s13.*@example.com). Las URL se toman de WEB_PORT y
MAIL_UI_PORT del .env (o de las variables WEB_URL y MAILPIT_URL).
Resultado: pruebas/resultados/<fecha-hora>/ con resumen.json, bitacora.md y PI-XX.json.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding="utf-8")

CONTRASENA = "Rural2026"
VALENTINA = "valentina.munoz@example.com"
CAMILA = "camila.rojas@example.com"
DIEGO = "diego.fuentes@example.com"
ROSA = "rosa.antinao@example.com"
JUAN_CARLOS = "juancarlos.millalonco@example.com"
CORREO_SEBASTIAN = "sebastian.torres@example.com"

SENDERO = "Sendero al mirador del volcán Lanín"
PESCA = "Pesca con mosca en el río Trancura"
COCINA = "Cocina de fogón: catuto y sopaipillas"
CABALGATA = "Cabalgata por el valle del río Maichín"
PALAFITO = "Palafito sobre el canal"
HUERTA = "Un día en la huerta y el invernadero"


def leer_env() -> dict[str, str]:
    """Solo los puertos: el resto del .env (claves) no se lee."""
    valores = {}
    ruta = RAIZ / ".env"
    if ruta.exists():
        for linea in ruta.read_text(encoding="utf-8").splitlines():
            clave, _, valor = linea.partition("=")
            if clave.strip() in ("WEB_PORT", "MAIL_UI_PORT"):
                valores[clave.strip()] = valor.split("#")[0].strip()
    return valores


ENV = leer_env()
WEB = os.environ.get("WEB_URL", f"http://localhost:{ENV.get('WEB_PORT', '8080')}")
MAILPIT = os.environ.get("MAILPIT_URL", f"http://localhost:{ENV.get('MAIL_UI_PORT', '8025')}")


# --- Acceso a los componentes -------------------------------------------------------------------


def http(metodo: str, url: str, cuerpo=None, token: str | None = None, cabeceras: dict | None = None, crudo: bytes | None = None):
    datos = crudo if crudo is not None else (json.dumps(cuerpo).encode() if cuerpo is not None else None)
    peticion = urllib.request.Request(url, data=datos, method=metodo)
    peticion.add_header("Content-Type", "application/json")
    if token:
        peticion.add_header("Authorization", f"Bearer {token}")
    for k, v in (cabeceras or {}).items():
        peticion.add_header(k, v)
    try:
        with urllib.request.urlopen(peticion, timeout=30) as r:
            codigo, texto, tipo = r.status, r.read().decode("utf-8", "replace"), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        codigo, texto, tipo = e.code, e.read().decode("utf-8", "replace"), e.headers.get("Content-Type", "")
    try:
        return codigo, json.loads(texto), tipo
    except ValueError:
        return codigo, texto, tipo


def psql(sql: str) -> list[list[str]]:
    """Consulta de solo lectura (o de limpieza) dentro del contenedor db; las credenciales no salen del contenedor."""
    salida = subprocess.run(
        ["docker", "compose", "exec", "-T", "db", "sh", "-c",
         'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F "|" -c "$1"', "sh", sql],
        cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout
    return [fila.split("|") for fila in salida.strip().splitlines() if fila]


def uno(sql: str) -> str:
    filas = psql(sql)
    return filas[0][0] if filas else ""


def correos() -> list[dict]:
    _, datos, _ = http("GET", f"{MAILPIT}/api/v1/messages?limit=500")
    return [{"para": [d["Address"] for d in m["To"]], "asunto": m["Subject"]} for m in datos.get("messages", [])]


def esperar_correo(para: str, asunto: str, segundos: float = 8) -> dict | None:
    """Los avisos se envían en segundo plano (BackgroundTasks): se espera un momento a que lleguen."""
    limite = time.time() + segundos
    while time.time() < limite:
        for m in correos():
            if para in m["para"] and m["asunto"].startswith(asunto):
                return m
        time.sleep(0.5)
    return None


def contar_correos(para: str, asunto: str) -> int:
    return sum(1 for m in correos() if para in m["para"] and m["asunto"].startswith(asunto))


def sql_texto(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def id_experiencia(titulo: str) -> int:
    return int(uno(f"SELECT id FROM experiencias WHERE titulo = {sql_texto(titulo)}"))


def cupos(experiencia_id: int) -> dict[str, int]:
    _, dias, _ = http("GET", f"{WEB}/api/experiencias/{experiencia_id}/disponibilidad")
    return {d["fecha"]: d["cupos"] for d in dias}


def total_reservas() -> int:
    return int(uno("SELECT count(*) FROM reservas"))


# --- Registro de un caso ------------------------------------------------------------------------


class Bloqueado(Exception):
    pass


class Caso:
    def __init__(self, meta: dict):
        self.meta = meta
        self.pasos: list[dict] = []
        self.verificaciones: list[tuple[str, bool]] = []
        self.observado: list[str] = []
        self.tokens: dict[str, str] = {}

    def token(self, correo: str) -> str:
        if correo not in self.tokens:
            codigo, r, _ = http("POST", f"{WEB}/api/auth/login", {"identificador": correo, "contrasena": CONTRASENA})
            if codigo != 200:
                raise Bloqueado(f"No se pudo iniciar sesión con {correo} (HTTP {codigo})")
            self.tokens[correo] = r["access_token"]
        return self.tokens[correo]

    def api(self, metodo: str, ruta: str, cuerpo=None, como: str | None = None, cabeceras=None, crudo=None, nota=""):
        token = self.token(como) if como else None
        codigo, respuesta, tipo = http(metodo, f"{WEB}/api{ruta}", cuerpo, token, cabeceras, crudo)
        resumen = respuesta if not isinstance(respuesta, str) else respuesta[:300]
        self.pasos.append({
            "peticion": f"{metodo} /api{ruta}", "usuario": como or "(sin sesión)", "cuerpo": cuerpo if crudo is None else crudo.decode(),
            "cabeceras_extra": cabeceras or {}, "codigo": codigo, "respuesta": resumen, "nota": nota,
        })
        return codigo, respuesta

    def web(self, ruta: str):
        codigo, respuesta, tipo = http("GET", f"{WEB}{ruta}")
        self.pasos.append({"peticion": f"GET {ruta} (nginx)", "codigo": codigo, "content_type": tipo,
                           "respuesta": respuesta[:120] if isinstance(respuesta, str) else respuesta})
        return codigo, respuesta, tipo

    def bd(self, descripcion: str, sql: str):
        filas = psql(sql)
        self.pasos.append({"consulta_bd": descripcion, "sql": sql, "filas": filas})
        return filas

    def ver(self, descripcion: str, condicion: bool):
        self.verificaciones.append((descripcion, bool(condicion)))

    def obs(self, texto: str):
        self.observado.append(texto)

    def resultado(self, estado: str | None = None, motivo: str = "") -> dict:
        if estado is None:
            estado = "PASS" if self.verificaciones and all(ok for _, ok in self.verificaciones) else "FAIL"
        return {
            **self.meta,
            "estado": estado,
            "obtenido": " ".join(self.observado) + (f" {motivo}" if motivo else ""),
            "verificaciones": [{"descripcion": d, "ok": ok} for d, ok in self.verificaciones],
            "fallidas": [d for d, ok in self.verificaciones if not ok],
            "pasos_ejecutados": self.pasos,
        }


def mensaje(r) -> str:
    """detail de FastAPI: texto, {campo, mensaje} o lista de errores de validación."""
    if not isinstance(r, dict):
        return str(r)
    d = r.get("detail")
    if isinstance(d, dict):
        return d.get("mensaje", "")
    if isinstance(d, list):
        return "; ".join(f"{'.'.join(map(str, e.get('loc', [])))}: {e.get('msg')}" for e in d)
    return str(d)


# Datos que pasan de un caso a otro (la reserva de PI-01 se usa en los flujos siguientes)
ESTADO: dict = {}


# --- Flujo A: solicitar una reserva -------------------------------------------------------------


def pi_01(c: Caso):
    exp = id_experiencia(SENDERO)
    codigo, detalle = c.api("GET", f"/experiencias/{exp}")
    precio, capacidad = float(detalle["precio_por_persona"]), detalle["capacidad_maxima"]
    dias = cupos(exp)
    fecha = next((f for f, n in sorted(dias.items()) if n >= 3), None)
    if fecha is None:
        raise Bloqueado("El sendero no tiene ningún día con 3 o más cupos")
    antes, reservas_antes = dias[fecha], total_reservas()
    codigo, r = c.api("POST", "/reservas", {"experiencia_id": exp, "fecha": fecha, "personas": 2,
                                            "metodo_pago": "transferencia", "correo": VALENTINA}, como=VALENTINA)
    c.ver("HTTP 201", codigo == 201)
    if codigo != 201:
        c.obs(f"HTTP {codigo}: {mensaje(r)}.")
        return
    ESTADO.update(reserva=r["id"], exp=exp, fecha=fecha, capacidad=capacidad, precio=precio)
    despues = cupos(exp)[fecha]
    fila = c.bd("Reserva guardada", f"SELECT estado, personas, total FROM reservas WHERE id = {r['id']}")
    c.ver("Estado pendiente", r["estado"] == "pendiente")
    c.ver("Total = precio × 2", float(r["total"]) == precio * 2)
    c.ver("Cupos del día descontados en 2", despues == antes - 2)
    c.ver("Fila en reservas con estado pendiente", fila and fila[0][0] == "pendiente")
    c.ver("Una reserva más en la base", total_reservas() == reservas_antes + 1)
    aviso_v = esperar_correo(VALENTINA, "Recibimos tu solicitud para")
    aviso_a = esperar_correo(ROSA, "Nueva solicitud de reserva")
    c.ver("Correo de acuse a la visitante", aviso_v)
    c.ver("Correo de aviso a la anfitriona", aviso_a)
    c.obs(f"HTTP 201, reserva #{r['id']} pendiente, total {r['total']:.0f} ({precio:.0f} × 2); "
          f"cupos del {fecha}: {antes} → {despues}; fila en BD = {fila[0] if fila else '—'}; "
          f"correos en Mailpit: visitante {'sí' if aviso_v else 'no'}, anfitriona {'sí' if aviso_a else 'no'}.")


def pi_02(c: Caso):
    if "reserva" not in ESTADO:
        raise Bloqueado("PI-01 no creó la reserva")
    rid, exp = ESTADO["reserva"], ESTADO["exp"]
    codigo, mias = c.api("GET", "/reservas/mias", como=VALENTINA)
    veces = sum(1 for x in mias if x["id"] == rid)
    codigo2, recibidas = c.api("GET", f"/experiencias/{exp}/reservas", como=ROSA)
    vista = next((x for x in recibidas if x["id"] == rid), None) if codigo2 == 200 else None
    filas = c.bd("Reservas de la visitante en el sendero",
                 f"SELECT count(*) FROM reservas r JOIN usuarios u ON u.id = r.visitante_id "
                 f"WHERE u.correo = {sql_texto(VALENTINA)} AND r.experiencia_id = {exp}")
    c.ver("Aparece exactamente una vez en Mis reservas", codigo == 200 and veces == 1)
    c.ver("La anfitriona la ve pendiente con el nombre de la visitante",
          vista and vista["estado"] == "pendiente" and vista["visitante"]["nombre"] == "Valentina Muñoz")
    c.ver("Una sola fila en la base", filas[0][0] == "1")
    c.obs(f"Mis reservas: {veces} vez; anfitriona: {'pendiente, ' + vista['visitante']['nombre'] if vista else 'no la ve'}; "
          f"filas en BD: {filas[0][0]}.")


def pi_03(c: Caso):
    exp = id_experiencia(PESCA)
    dias = cupos(exp)
    agotado = next((f for f, n in sorted(dias.items()) if n == 0), None)
    if agotado is None:
        raise Bloqueado("La pesca con mosca no tiene un día abierto con 0 cupos")
    antes = total_reservas()
    codigo, r = c.api("POST", "/reservas", {"experiencia_id": exp, "fecha": agotado, "personas": 1,
                                            "metodo_pago": "efectivo", "correo": VALENTINA}, como=VALENTINA)
    c.ver("HTTP 409", codigo == 409)
    c.ver("Mensaje de fecha sin cupos", mensaje(r) == "Esta fecha ya no tiene cupos disponibles. Elige otra")
    c.ver("No se crea reserva", total_reservas() == antes)
    c.ver("El día sigue con 0 cupos", cupos(exp)[agotado] == 0)
    c.obs(f"HTTP {codigo} «{mensaje(r)}»; reservas en BD {antes} → {total_reservas()}; cupos del {agotado}: 0 → {cupos(exp)[agotado]}.")


def pi_04(c: Caso):
    if "reserva" not in ESTADO:
        raise Bloqueado("PI-01 no creó la reserva")
    exp, fecha = ESTADO["exp"], ESTADO["fecha"]
    libres, antes = cupos(exp)[fecha], total_reservas()
    if libres < 1 or libres + 1 > ESTADO["capacidad"]:
        raise Bloqueado(f"El día {fecha} tiene {libres} cupos: no sirve para probar el límite")
    codigo, r = c.api("POST", "/reservas", {"experiencia_id": exp, "fecha": fecha, "personas": libres + 1,
                                            "metodo_pago": "transferencia", "correo": VALENTINA}, como=VALENTINA)
    esperado = f"Solo {'queda 1 cupo' if libres == 1 else f'quedan {libres} cupos'} para esta fecha"
    c.ver("HTTP 409", codigo == 409)
    c.ver("Mensaje con los cupos que quedan", mensaje(r) == esperado)
    c.ver("No se crea reserva", total_reservas() == antes)
    c.ver("Los cupos no cambian", cupos(exp)[fecha] == libres)
    c.obs(f"Quedaban {libres} cupos y se pidieron {libres + 1}: HTTP {codigo} «{mensaje(r)}»; "
          f"reservas {antes} → {total_reservas()}; cupos {libres} → {cupos(exp)[fecha]}.")


def pi_05(c: Caso):
    if "reserva" not in ESTADO:
        raise Bloqueado("PI-01 no creó la reserva")
    exp, fecha, capacidad = ESTADO["exp"], ESTADO["fecha"], ESTADO["capacidad"]
    base = {"experiencia_id": exp, "fecha": fecha, "personas": 1, "metodo_pago": "transferencia", "correo": VALENTINA}
    antes = total_reservas()
    variantes = [
        ("fecha pasada (2020-01-01)", {"fecha": "2020-01-01"}, 422, "Esa fecha ya pasó. Elige otra"),
        ("sin método de pago en experiencia con precio", {"metodo_pago": None}, 422, "Elige cómo vas a pagar"),
        ("personas = 0", {"personas": 0}, 422, "personas"),
        (f"personas = capacidad + 1 ({capacidad + 1})", {"personas": capacidad + 1}, 422, f"Esta experiencia admite hasta {capacidad} personas"),
        ("2 noches en una experiencia que no es hospedaje", {"noches": 2}, 422, "Esta experiencia se reserva por un solo día"),
        ("correo con formato inválido", {"correo": "no-es-un-correo"}, 422, "correo"),
        ("experiencia inexistente (id 999999)", {"experiencia_id": 999999}, 404, "Esta experiencia no está disponible para reservar"),
    ]
    detalles = []
    for nombre, cambio, codigo_esperado, texto in variantes:
        codigo, r = c.api("POST", "/reservas", {**base, **cambio}, como=VALENTINA, nota=nombre)
        ok = codigo == codigo_esperado and texto in mensaje(r)
        c.ver(f"{nombre}: HTTP {codigo_esperado} con «{texto}»", ok)
        detalles.append(f"{nombre} → {codigo}")
    c.ver("Ninguna variante crea reservas", total_reservas() == antes)
    c.obs("; ".join(detalles) + f"; reservas en BD {antes} → {total_reservas()}.")


def pi_06(c: Caso):
    if "reserva" not in ESTADO:
        raise Bloqueado("PI-01 no creó la reserva")
    exp, fecha, rid = ESTADO["exp"], ESTADO["fecha"], ESTADO["reserva"]
    cuerpo = {"experiencia_id": exp, "fecha": fecha, "personas": 1, "metodo_pago": "transferencia", "correo": ROSA}
    antes = total_reservas()
    c1, r1 = c.api("POST", "/reservas", cuerpo, nota="sin token")
    c2, r2 = c.api("POST", "/reservas", cuerpo, como=ROSA, nota="la anfitriona reserva su propia experiencia")
    c3, r3 = c.api("PATCH", f"/reservas/{rid}/confirmar", como=VALENTINA, nota="una visitante intenta confirmar")
    c4, r4 = c.api("PATCH", f"/reservas/{rid}/confirmar", como=JUAN_CARLOS, nota="otro anfitrión intenta confirmar")
    estado = uno(f"SELECT estado FROM reservas WHERE id = {rid}")
    c.ver("Sin sesión: HTTP 401", c1 == 401)
    c.ver("Reserva propia: HTTP 403 «No puedes reservar tu propia experiencia»", c2 == 403 and mensaje(r2) == "No puedes reservar tu propia experiencia")
    c.ver("Visitante no puede confirmar: HTTP 403", c3 == 403)
    c.ver("Anfitrión ajeno no ve la reserva: HTTP 404", c4 == 404)
    c.ver("No se crean reservas", total_reservas() == antes)
    c.ver("La reserva de PI-01 sigue pendiente", estado == "pendiente")
    c.obs(f"Sin sesión → {c1}; propia → {c2} «{mensaje(r2)}»; visitante confirma → {c3}; otro anfitrión → {c4}; "
          f"reserva #{rid} sigue «{estado}».")


# --- Flujo B: gestionar y pagar la reserva ------------------------------------------------------


def pi_07(c: Caso):
    if "reserva" not in ESTADO:
        raise Bloqueado("PI-01 no creó la reserva")
    rid = ESTADO["reserva"]
    codigo, r = c.api("PATCH", f"/reservas/{rid}/confirmar", como=ROSA)
    aviso = esperar_correo(VALENTINA, "¡Tu reserva está confirmada!")
    codigo2, r2 = c.api("PATCH", f"/reservas/{rid}/confirmar", como=ROSA, nota="segunda confirmación")
    estado = c.bd("Estado guardado", f"SELECT estado FROM reservas WHERE id = {rid}")[0][0]
    c.ver("HTTP 200 y estado confirmada", codigo == 200 and r.get("estado") == "confirmada")
    c.ver("Correo de confirmación a la visitante", aviso)
    c.ver("Segunda confirmación: HTTP 409 «Esta reserva ya estaba confirmada»", codigo2 == 409 and mensaje(r2) == "Esta reserva ya estaba confirmada")
    c.ver("En la base queda confirmada", estado == "confirmada")
    c.obs(f"Confirmar → {codigo} «{r.get('estado')}»; correo {'sí' if aviso else 'no'}; repetir → {codigo2} «{mensaje(r2)}»; BD: {estado}.")


def pi_08(c: Caso):
    filas = psql(f"SELECT r.id, r.fecha, r.personas, r.experiencia_id FROM reservas r JOIN experiencias e ON e.id = r.experiencia_id "
                 f"WHERE e.titulo = {sql_texto(COCINA)} AND r.estado = 'pendiente' ORDER BY r.id LIMIT 1")
    if not filas:
        raise Bloqueado("No hay una solicitud pendiente en la cocina de fogón")
    rid, fecha, personas, exp = int(filas[0][0]), filas[0][1], int(filas[0][2]), int(filas[0][3])
    antes = cupos(exp).get(fecha)
    codigo, r = c.api("PATCH", f"/reservas/{rid}/rechazar", como=ROSA)
    despues = cupos(exp).get(fecha)
    aviso = esperar_correo(CORREO_SEBASTIAN, "Tu solicitud para")
    codigo2, r2 = c.api("PATCH", f"/reservas/{rid}/rechazar", como=ROSA, nota="segundo rechazo")
    c.ver("HTTP 200 y estado rechazada", codigo == 200 and r.get("estado") == "rechazada")
    c.ver(f"Cupos del día liberados (+{personas})", antes is not None and despues == antes + personas)
    c.ver("Correo de rechazo al visitante", aviso)
    c.ver("Segundo rechazo: HTTP 409 «Esta reserva fue rechazada»", codigo2 == 409 and mensaje(r2) == "Esta reserva fue rechazada")
    c.obs(f"Reserva #{rid} ({personas} personas, {fecha}): rechazar → {codigo}; cupos {antes} → {despues}; "
          f"correo {'sí' if aviso else 'no'}; repetir → {codigo2} «{mensaje(r2)}».")


def esperar_pago(c: Caso, pago_id: int, como: str, segundos: float = 10) -> dict:
    limite = time.time() + segundos
    while True:
        codigo, pago = http("GET", f"{WEB}/api/pagos/{pago_id}", token=c.token(como))[:2]
        if pago.get("estado") != "pendiente" or time.time() > limite:
            c.pasos.append({"peticion": f"GET /api/pagos/{pago_id} (hasta que se resuelve)", "usuario": como, "codigo": codigo, "respuesta": pago})
            return pago
        time.sleep(0.5)


def pi_09(c: Caso):
    if "reserva" not in ESTADO:
        raise Bloqueado("PI-01 no creó la reserva")
    rid = ESTADO["reserva"]
    if uno(f"SELECT estado FROM reservas WHERE id = {rid}") != "confirmada":
        raise Bloqueado("La reserva de PI-01 no está confirmada (depende de PI-07)")
    codigo, p = c.api("POST", "/pagos", {"reserva_id": rid}, como=VALENTINA)
    if codigo != 201:
        c.ver("HTTP 201 al iniciar el pago", False)
        c.obs(f"Iniciar pago → {codigo} «{mensaje(p)}».")
        return
    codigo2, _ = c.api("POST", f"/pagos/{p['id']}/simular", {"aprobar": True}, como=VALENTINA)
    pago = esperar_pago(c, p["id"], VALENTINA)
    fila = c.bd("Reserva y pago", f"SELECT r.estado, r.metodo_pago, p.estado FROM reservas r JOIN pagos p ON p.reserva_id = r.id WHERE p.id = {p['id']}")
    aviso = esperar_correo(VALENTINA, "Pago recibido:")
    c.ver("HTTP 201 y URL de la pasarela simulada", p["url_pago"].endswith(f"/pagos/{p['id']}/simulado"))
    c.ver("Simular aprobado: HTTP 200", codigo2 == 200)
    c.ver("El webhook deja el pago aprobado", pago.get("estado") == "aprobado")
    c.ver("Reserva pagada con método en_linea", fila and fila[0][0] == "pagada" and fila[0][1] == "en_linea")
    c.ver("Correo «Pago recibido» a la visitante", aviso)
    c.obs(f"Pago #{p['id']} → {pago.get('estado')}; BD: reserva {fila[0][0]}, método {fila[0][1]}, pago {fila[0][2]}; "
          f"correo {'sí' if aviso else 'no'}.")


def reserva_de(titulo: str, correo: str, estado: str) -> tuple[int, float]:
    filas = psql(f"SELECT r.id, r.total FROM reservas r JOIN experiencias e ON e.id = r.experiencia_id JOIN usuarios u ON u.id = r.visitante_id "
                 f"WHERE e.titulo = {sql_texto(titulo)} AND u.correo = {sql_texto(correo)} AND r.estado = {sql_texto(estado)} ORDER BY r.id LIMIT 1")
    if not filas:
        raise Bloqueado(f"No hay una reserva «{estado}» de {correo} en «{titulo}»")
    return int(filas[0][0]), float(filas[0][1])


def pi_10(c: Caso):
    rid, _ = reserva_de(CABALGATA, CAMILA, "confirmada")
    correos_antes = contar_correos(CAMILA, "Pago recibido:")
    codigo, p = c.api("POST", "/pagos", {"reserva_id": rid}, como=CAMILA)
    c.ver("HTTP 201 al iniciar el pago", codigo == 201)
    if codigo != 201:
        c.obs(f"Iniciar pago → {codigo} «{mensaje(p)}».")
        return
    c.api("POST", f"/pagos/{p['id']}/simular", {"aprobar": False}, como=CAMILA)
    pago = esperar_pago(c, p["id"], CAMILA)
    time.sleep(2)
    estado = c.bd("Estado de la reserva", f"SELECT estado FROM reservas WHERE id = {rid}")[0][0]
    nuevos = contar_correos(CAMILA, "Pago recibido:") - correos_antes
    c.ver("El webhook deja el pago rechazado", pago.get("estado") == "rechazado")
    c.ver("La reserva sigue confirmada", estado == "confirmada")
    c.ver("No se envía correo de pago", nuevos == 0)
    ESTADO["reserva_camila"] = rid
    c.obs(f"Reserva #{rid}: pago #{p['id']} → {pago.get('estado')}; reserva sigue «{estado}»; correos de pago nuevos: {nuevos}.")


def pi_11(c: Caso):
    rid, total = reserva_de(CABALGATA, CAMILA, "confirmada")
    codigo, p = c.api("POST", "/pagos", {"reserva_id": rid}, como=CAMILA)
    if codigo != 201:
        raise Bloqueado(f"No se pudo crear el pago a falsificar (HTTP {codigo})")
    aviso = json.dumps({"pago_id": p["id"], "estado": "aprobado", "id_transaccion": "falso-s13", "monto": str(total)}).encode()
    c1, r1 = c.api("POST", "/pagos/webhook", crudo=aviso, cabeceras={"X-Firma-Simulada": "0" * 64}, nota="firma inventada")
    c2, r2 = c.api("POST", "/pagos/webhook", crudo=aviso, nota="sin cabecera de firma")
    pago = http("GET", f"{WEB}/api/pagos/{p['id']}", token=c.token(CAMILA))[1]
    estado = c.bd("Reserva tras los avisos falsos", f"SELECT r.estado, p.estado FROM reservas r JOIN pagos p ON p.reserva_id = r.id WHERE p.id = {p['id']}")[0]
    c.ver("Firma inventada: HTTP 401 «Firma inválida»", c1 == 401 and mensaje(r1) == "Firma inválida")
    c.ver("Sin firma: HTTP 401", c2 == 401)
    c.ver("El pago sigue pendiente", pago.get("estado") == "pendiente" and estado[1] == "pendiente")
    c.ver("La reserva sigue confirmada", estado[0] == "confirmada")
    c.obs(f"Aviso «aprobado» falso para el pago #{p['id']}: firma inventada → {c1}, sin firma → {c2}; "
          f"BD: reserva {estado[0]}, pago {estado[1]}.")


def pi_12(c: Caso):
    pendiente, _ = reserva_de(PALAFITO, CAMILA, "pendiente")
    gratuita, _ = reserva_de(HUERTA, DIEGO, "confirmada")
    ajena = ESTADO.get("reserva_camila") or reserva_de(CABALGATA, CAMILA, "confirmada")[0]
    antes = int(uno("SELECT count(*) FROM pagos"))
    c1, r1 = c.api("POST", "/pagos", {"reserva_id": pendiente}, como=CAMILA, nota="reserva aún pendiente")
    c2, r2 = c.api("POST", "/pagos", {"reserva_id": gratuita}, como=DIEGO, nota="reserva gratuita")
    c3, r3 = c.api("POST", "/pagos", {"reserva_id": ajena}, como=VALENTINA, nota="reserva de otra persona")
    despues = int(uno("SELECT count(*) FROM pagos"))
    c.ver("Pendiente: HTTP 409", c1 == 409)
    c.ver("Gratuita: HTTP 409 «Esta reserva es gratuita: no hay nada que pagar»", c2 == 409 and mensaje(r2) == "Esta reserva es gratuita: no hay nada que pagar")
    c.ver("Ajena: HTTP 404", c3 == 404)
    c.ver("No se crean pagos", despues == antes)
    c.obs(f"Pendiente → {c1} «{mensaje(r1)}»; gratuita → {c2}; ajena → {c3}; pagos en BD {antes} → {despues}.")


def pi_13(c: Caso):
    if "reserva" not in ESTADO:
        raise Bloqueado("PI-01 no creó la reserva")
    rid, exp, fecha = ESTADO["reserva"], ESTADO["exp"], ESTADO["fecha"]
    antes = cupos(exp)[fecha]
    codigo, r = c.api("PATCH", f"/reservas/{rid}/cancelar", como=VALENTINA)
    despues = cupos(exp)[fecha]
    codigo2, r2 = c.api("PATCH", f"/reservas/{rid}/cancelar", como=VALENTINA, nota="segunda cancelación")
    codigo3, r3 = c.api("PATCH", f"/reservas/{rid}/confirmar", como=ROSA, nota="la anfitriona intenta confirmarla")
    c.ver("HTTP 200 y estado cancelada", codigo == 200 and r.get("estado") == "cancelada")
    c.ver("Cupos del día devueltos (+2)", despues == antes + 2)
    c.ver("Segunda cancelación: HTTP 409 «Esta reserva ya estaba cancelada»", codigo2 == 409 and mensaje(r2) == "Esta reserva ya estaba cancelada")
    c.ver("No se puede confirmar una cancelada: HTTP 409", codigo3 == 409)
    c.obs(f"Cancelar → {codigo} «{r.get('estado')}»; cupos {antes} → {despues}; repetir → {codigo2}; confirmar → {codigo3} «{mensaje(r3)}».")


# --- Cuentas y regresión ------------------------------------------------------------------------


def pi_14(c: Caso):
    nuevo = f"prueba.s13.{int(time.time())}@example.com"
    variantes = [
        ("correo ya registrado", {"correo": CAMILA, "contrasena": "Prueba2026", "nombre": "Prueba"}, 409, "Este correo ya está registrado"),
        ("contraseña sin números", {"correo": nuevo, "contrasena": "solamenteletras", "nombre": "Prueba"}, 422, "letras y números"),
        ("contraseña de 7 caracteres", {"correo": nuevo, "contrasena": "abc1234", "nombre": "Prueba"}, 422, "contrasena"),
        ("visitante sin nombre", {"correo": nuevo, "contrasena": "Prueba2026"}, 422, "Ingresa tu nombre"),
        ("sin correo ni teléfono", {"contrasena": "Prueba2026", "nombre": "Prueba"}, 422, "Debes indicar un correo o un teléfono"),
        ("intento de registrarse como admin", {"correo": nuevo, "contrasena": "Prueba2026", "nombre": "Prueba", "rol": "admin"}, 422, "rol"),
    ]
    rechazadas = []
    for nombre, cuerpo, esperado, texto in variantes:
        codigo, r = c.api("POST", "/auth/registro", cuerpo, nota=nombre)
        ok = codigo == esperado and texto in mensaje(r)
        c.ver(f"{nombre}: HTTP {esperado} con «{texto}»", ok)
        rechazadas.append(f"{nombre} → {codigo}")
    c.ver("Los intentos fallidos no crean la cuenta", uno(f"SELECT count(*) FROM usuarios WHERE correo = {sql_texto(nuevo)}") == "0")
    codigo, r = c.api("POST", "/auth/registro", {"correo": nuevo, "contrasena": "Prueba2026", "nombre": "Prueba Semana 13"}, nota="registro válido")
    codigo2, t = c.api("POST", "/auth/login", {"identificador": nuevo.upper(), "contrasena": "Prueba2026"}, nota="login con el correo en mayúsculas")
    yo = http("GET", f"{WEB}/api/auth/me", token=t.get("access_token"))[1] if codigo2 == 200 else {}
    filas = c.bd("Cuenta creada", f"SELECT rol, nombre, contrasena_hash LIKE '$2%' FROM usuarios WHERE correo = {sql_texto(nuevo)}")
    c.ver("Registro válido: HTTP 201 como visitante", codigo == 201 and r.get("rol") == "visitante")
    c.ver("Inicia sesión y /auth/me devuelve la cuenta", codigo2 == 200 and yo.get("correo") == nuevo)
    c.ver("Una fila con la contraseña guardada como hash bcrypt", filas and filas[0][2] == "t")
    c.obs("; ".join(rechazadas) + f"; registro válido → {codigo}; login → {codigo2}; "
          f"BD: {filas[0][:2] if filas else '—'}, hash bcrypt {'sí' if filas and filas[0][2] == 't' else 'no'}.")


def pi_15(c: Caso):
    c1, html, tipo1 = c.web("/")
    c2, html2, tipo2 = c.web("/mis-reservas")
    c3, salud = c.api("GET", "/health")
    c4, _, _ = c.web("/api/docs")
    codigo, pagina = c.api("GET", "/experiencias?localidad=Curarrehue")
    items = pagina.get("items", []) if isinstance(pagina, dict) else []
    c.ver("Inicio servido por nginx (HTML de la SPA)", c1 == 200 and "text/html" in tipo1 and 'id="root"' in html)
    c.ver("Ruta interna /mis-reservas devuelve la SPA (no 404)", c2 == 200 and 'id="root"' in html2)
    c.ver("/api/health a través del proxy: base conectada", c3 == 200 and salud == {"status": "ok", "base_de_datos": "conectada"})
    c.ver("Swagger accesible en /api/docs", c4 == 200)
    c.ver("Filtro por localidad: solo Curarrehue", codigo == 200 and items and all(x["localidad"] == "Curarrehue" for x in items))
    c.obs(f"/ → {c1}; /mis-reservas → {c2}; /api/health → {c3} {salud}; /api/docs → {c4}; "
          f"filtro Curarrehue → {len(items)} experiencias, todas de Curarrehue: {all(x['localidad'] == 'Curarrehue' for x in items)}.")


# --- Definición de los casos (la misma información alimenta la matriz) --------------------------

CASOS = [
    dict(id="PI-01", funcion=pi_01, flujo="A", hu="HU14, HU13, HU17", interfaces="INT-01, INT-02, INT-03", prioridad="Alta",
         escenario="Operación válida", objetivo="Una solicitud de reserva válida se guarda, descuenta cupos y avisa por correo.",
         precondiciones="Datos de datos_demo; Valentina Muñoz sin reservas en el sendero; el sendero tiene un día con 3 o más cupos.",
         datos=f"Valentina Muñoz ({VALENTINA}); «{SENDERO}»; primer día con ≥3 cupos; 2 personas; transferencia.",
         pasos="1. Iniciar sesión como Valentina. 2. Consultar cupos del día (GET /api/experiencias/{id}/disponibilidad). "
               "3. POST /api/reservas. 4. Volver a consultar cupos. 5. Consultar la fila en reservas. 6. Revisar Mailpit.",
         esperado="HTTP 201, estado «pendiente», total = precio × 2; cupos del día bajan en 2; una fila nueva en reservas; "
                  "correo «Recibimos tu solicitud…» a la visitante y «Nueva solicitud de reserva…» a la anfitriona.",
         evidencia="Respuesta HTTP, cupos antes/después, fila de la BD y asuntos de Mailpit."),
    dict(id="PI-02", funcion=pi_02, flujo="A", hu="HU16, HU15", interfaces="INT-01, INT-02", prioridad="Media",
         escenario="Consistencia", objetivo="La reserva creada aparece una sola vez para la visitante y la anfitriona la ve.",
         precondiciones="PI-01 ejecutado con PASS.", datos="Reserva creada en PI-01.",
         pasos="1. GET /api/reservas/mias como Valentina. 2. GET /api/experiencias/{id}/reservas como Rosa. 3. Contar filas en la BD.",
         esperado="La reserva aparece exactamente 1 vez en Mis reservas; la anfitriona la ve «pendiente» con el nombre «Valentina Muñoz»; 1 fila en la BD.",
         evidencia="Listados HTTP y conteo en la BD."),
    dict(id="PI-03", funcion=pi_03, flujo="A", hu="HU14, HU13", interfaces="INT-02", prioridad="Alta",
         escenario="Sin disponibilidad", objetivo="No se acepta una reserva en un día agotado.",
         precondiciones="La pesca con mosca tiene su primer día abierto agotado (0 cupos) por datos_demo.",
         datos=f"Valentina; «{PESCA}»; día con 0 cupos; 1 persona; efectivo.",
         pasos="1. Consultar la disponibilidad y ubicar el día con 0 cupos. 2. Contar reservas en la BD. 3. POST /api/reservas. 4. Volver a contar y consultar cupos.",
         esperado="HTTP 409 «Esta fecha ya no tiene cupos disponibles. Elige otra»; no se crea reserva; el día sigue con 0 cupos.",
         evidencia="Respuesta HTTP y conteos antes/después."),
    dict(id="PI-04", funcion=pi_04, flujo="A", hu="HU14", interfaces="INT-02", prioridad="Media",
         escenario="Valor límite", objetivo="Pedir un cupo más de los que quedan se rechaza sin sobreventa.",
         precondiciones="PI-01 ejecutado (el día quedó con cupos libres menores que la capacidad).",
         datos="Mismo día de PI-01; personas = cupos libres + 1.",
         pasos="1. Consultar cupos libres (N). 2. POST /api/reservas con N + 1 personas. 3. Contar reservas y consultar cupos.",
         esperado="HTTP 409 «Solo quedan N cupos para esta fecha»; no se crea reserva; los cupos no cambian.",
         evidencia="Respuesta HTTP y cupos antes/después."),
    dict(id="PI-05", funcion=pi_05, flujo="A", hu="HU14", interfaces="INT-01", prioridad="Alta",
         escenario="Datos inválidos", objetivo="El backend rechaza entradas inválidas con un mensaje comprensible y sin crear registros.",
         precondiciones="PI-01 ejecutado (se reutiliza su experiencia y fecha).",
         datos="Fecha 2020-01-01; sin método de pago; 0 personas; capacidad + 1; 2 noches; correo «no-es-un-correo»; experiencia 999999.",
         pasos="1. Contar reservas. 2. Enviar POST /api/reservas con cada variante. 3. Volver a contar.",
         esperado="422 con el mensaje de cada regla («Esa fecha ya pasó…», «Elige cómo vas a pagar», «admite hasta N personas», "
                  "«se reserva por un solo día», errores de campo) y 404 para la experiencia inexistente; ninguna reserva nueva.",
         evidencia="Código y mensaje de cada respuesta; conteo de la BD."),
    dict(id="PI-06", funcion=pi_06, flujo="A", hu="HU01, HU14, HU15", interfaces="INT-01", prioridad="Alta",
         escenario="Permisos", objetivo="Solo usuarios autorizados pueden reservar y confirmar.",
         precondiciones="PI-01 ejecutado (reserva pendiente de Rosa).",
         datos="Sin token; Rosa (dueña); Valentina (visitante); Juan Carlos (otro anfitrión).",
         pasos="1. POST /api/reservas sin token. 2. Rosa reserva su propio sendero. 3. Valentina y Juan Carlos intentan PATCH /confirmar. 4. Revisar la BD.",
         esperado="401 sin sesión; 403 «No puedes reservar tu propia experiencia»; 403 para la visitante; 404 para el anfitrión ajeno; la reserva sigue pendiente.",
         evidencia="Códigos HTTP y estado en la BD."),
    dict(id="PI-07", funcion=pi_07, flujo="B", hu="HU15, HU17", interfaces="INT-04, INT-03", prioridad="Alta",
         escenario="Operación válida + duplicado", objetivo="La anfitriona confirma la solicitud, se avisa por correo y no se puede confirmar dos veces.",
         precondiciones="Reserva de PI-01 en estado pendiente.", datos="Rosa Antinao; reserva de PI-01.",
         pasos="1. PATCH /api/reservas/{id}/confirmar como Rosa. 2. Revisar Mailpit. 3. Repetir el PATCH. 4. Consultar la BD.",
         esperado="200 «confirmada»; correo «¡Tu reserva está confirmada!…» a la visitante; la repetición da 409 «Esta reserva ya estaba confirmada».",
         evidencia="Respuestas HTTP, asunto en Mailpit y estado en la BD."),
    dict(id="PI-08", funcion=pi_08, flujo="B", hu="HU15, HU13, HU17", interfaces="INT-04, INT-03", prioridad="Alta",
         escenario="Liberación de cupos", objetivo="Rechazar una solicitud devuelve sus cupos y avisa al visitante.",
         precondiciones="Solicitud pendiente de Sebastián Torres (4 personas) en la cocina de fogón, creada por datos_demo.",
         datos=f"Rosa; reserva pendiente en «{COCINA}»; correo de aviso {CORREO_SEBASTIAN}.",
         pasos="1. Consultar cupos del día. 2. PATCH /rechazar como Rosa. 3. Consultar cupos. 4. Revisar Mailpit. 5. Repetir el PATCH.",
         esperado="200 «rechazada»; cupos del día + 4; correo «Tu solicitud para … no fue aceptada»; la repetición da 409 «Esta reserva fue rechazada».",
         evidencia="Cupos antes/después, respuestas HTTP y asunto en Mailpit."),
    dict(id="PI-09", funcion=pi_09, flujo="B", hu="HU18, HU17", interfaces="INT-05, INT-02, INT-03", prioridad="Alta",
         escenario="Operación válida", objetivo="Un pago en línea aprobado llega por webhook y deja la reserva pagada.",
         precondiciones="Reserva de PI-01 confirmada (PI-07); PROVEEDOR_PAGO=simulado.", datos="Valentina; reserva de PI-01.",
         pasos="1. POST /api/pagos. 2. POST /api/pagos/{id}/simular {aprobar: true}. 3. Consultar GET /api/pagos/{id} hasta que se resuelva. 4. Revisar la BD y Mailpit.",
         esperado="201 con URL /pagos/{id}/simulado; el webhook deja el pago «aprobado»; reserva «pagada» con método «en_linea»; correo «Pago recibido: …».",
         evidencia="Respuestas HTTP, filas de reservas y pagos, asunto en Mailpit."),
    dict(id="PI-10", funcion=pi_10, flujo="B", hu="HU18", interfaces="INT-05", prioridad="Media",
         escenario="Pago rechazado", objetivo="Un pago rechazado no cambia la reserva ni envía comprobante.",
         precondiciones="Reserva confirmada de Camila Rojas en la cabalgata (datos_demo).", datos=f"Camila ({CAMILA}); «{CABALGATA}».",
         pasos="1. POST /api/pagos. 2. POST /simular {aprobar: false}. 3. Consultar el pago. 4. Revisar la BD y Mailpit.",
         esperado="Pago «rechazado»; la reserva sigue «confirmada»; no llega correo «Pago recibido».",
         evidencia="Estado del pago, fila de la reserva y conteo de correos."),
    dict(id="PI-11", funcion=pi_11, flujo="B", hu="HU18", interfaces="INT-05", prioridad="Alta",
         escenario="Aviso falsificado", objetivo="El webhook rechaza avisos sin firma válida.",
         precondiciones="Reserva confirmada de Camila en la cabalgata; pago pendiente recién creado.",
         datos="Cuerpo {pago_id, estado: aprobado, monto} con X-Firma-Simulada inventada y sin cabecera.",
         pasos="1. POST /api/pagos como Camila. 2. POST /api/pagos/webhook con firma falsa. 3. Repetir sin firma. 4. Consultar pago y reserva.",
         esperado="401 «Firma inválida» en ambos; el pago sigue «pendiente» y la reserva «confirmada».",
         evidencia="Respuestas HTTP y filas de pagos/reservas."),
    dict(id="PI-12", funcion=pi_12, flujo="B", hu="HU18", interfaces="INT-05, INT-02", prioridad="Media",
         escenario="Pago no permitido", objetivo="No se puede pagar una reserva pendiente, gratuita o ajena.",
         precondiciones="datos_demo: palafito pendiente de Camila; huerta gratuita confirmada de Diego.",
         datos="Camila (palafito pendiente), Diego (huerta gratuita), Valentina (reserva de Camila).",
         pasos="1. POST /api/pagos para cada caso. 2. Contar pagos en la BD antes y después.",
         esperado="409 para la pendiente; 409 «Esta reserva es gratuita: no hay nada que pagar»; 404 para la ajena; ningún pago nuevo.",
         evidencia="Respuestas HTTP y conteo de pagos."),
    dict(id="PI-13", funcion=pi_13, flujo="B", hu="HU16, HU13", interfaces="INT-02, INT-04", prioridad="Media",
         escenario="Cancelación", objetivo="Cancelar una reserva devuelve los cupos y no admite más cambios.",
         precondiciones="Reserva de PI-01 activa (pagada tras PI-09).", datos="Valentina; reserva de PI-01.",
         pasos="1. Consultar cupos. 2. PATCH /cancelar como Valentina. 3. Consultar cupos. 4. Repetir. 5. Rosa intenta confirmarla.",
         esperado="200 «cancelada»; cupos + 2; repetir da 409 «Esta reserva ya estaba cancelada»; confirmar da 409.",
         evidencia="Respuestas HTTP y cupos antes/después."),
    dict(id="PI-14", funcion=pi_14, flujo="—", hu="HU01, HU03", interfaces="INT-06", prioridad="Media",
         escenario="Datos inválidos + duplicado", objetivo="El registro valida las entradas, evita duplicados y guarda la contraseña cifrada.",
         precondiciones="Ninguna cuenta prueba.s13.*@example.com (se borran al restablecer).",
         datos="Correo de Camila (duplicado); contraseñas «solamenteletras» y «abc1234»; sin nombre; sin correo ni teléfono; rol admin; cuenta nueva prueba.s13.<n>@example.com.",
         pasos="1. POST /api/auth/registro con cada variante. 2. Registro válido. 3. Login con el correo en mayúsculas y GET /api/auth/me. 4. Consultar la BD.",
         esperado="409 para el duplicado y 422 con su mensaje para el resto, sin crear la cuenta; el registro válido da 201 como visitante, "
                  "el login funciona y la contraseña queda como hash bcrypt.",
         evidencia="Respuestas HTTP y fila de usuarios."),
    dict(id="PI-15", funcion=pi_15, flujo="—", hu="HU10, HU11, HU21", interfaces="INT-01", prioridad="Baja",
         escenario="Regresión", objetivo="Tras los casos anteriores, la web, el proxy y el catálogo siguen funcionando.",
         precondiciones="App en marcha.", datos="Rutas /, /mis-reservas, /api/health, /api/docs; filtro localidad=Curarrehue.",
         pasos="1. GET / y /mis-reservas en nginx. 2. GET /api/health y /api/docs. 3. GET /api/experiencias?localidad=Curarrehue.",
         esperado="HTML de la SPA en ambas rutas; salud «ok» con la base conectada; Swagger 200; el filtro solo devuelve experiencias de Curarrehue.",
         evidencia="Códigos HTTP, tipo de contenido y listado filtrado."),
]


def entorno() -> dict:
    def cmd(*args):
        try:
            return subprocess.run(args, cwd=RAIZ, capture_output=True, text=True, encoding="utf-8").stdout.strip()
        except OSError:
            return ""
    return {
        "fecha": datetime.now().isoformat(timespec="seconds"),
        "rama": cmd("git", "rev-parse", "--abbrev-ref", "HEAD"),
        "commit": cmd("git", "rev-parse", "--short", "HEAD"),
        "commit_mensaje": cmd("git", "log", "-1", "--format=%s"),
        "docker": cmd("docker", "version", "--format", "{{.Server.Version}}"),
        "compose": cmd("docker", "compose", "version", "--short"),
        "web": WEB,
        "mailpit": MAILPIT,
        "contenedores": cmd("docker", "compose", "ps", "--format", "{{.Service}}: {{.Status}}").splitlines(),
    }


def restablecer():
    print("Restableciendo datos de prueba (datos_demo, Mailpit, cuentas prueba.s13)...")
    subprocess.run(["docker", "compose", "exec", "-T", "backend", "python", "-m", "scripts.datos_demo"],
                   cwd=RAIZ, check=True, capture_output=True)
    psql("DELETE FROM usuarios WHERE correo LIKE 'prueba.s13.%@example.com'")
    http("DELETE", f"{MAILPIT}/api/v1/messages")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sin-reset", action="store_true", help="no restablecer los datos antes de ejecutar")
    args = parser.parse_args()

    if not args.sin_reset:
        restablecer()
    salida = RAIZ / "pruebas" / "resultados" / datetime.now().strftime("%Y-%m-%d_%H%M%S")
    salida.mkdir(parents=True)
    info = entorno()
    resultados = []
    for meta in CASOS:
        caso = Caso({k: v for k, v in meta.items() if k != "funcion"})
        try:
            meta["funcion"](caso)
            r = caso.resultado()
        except Bloqueado as e:
            r = caso.resultado("BLOCKED", f"Bloqueado: {e}")
        except Exception as e:  # un error del script no es un defecto del producto: se informa aparte
            r = caso.resultado("BLOCKED", f"Error al ejecutar el caso: {type(e).__name__}: {e}")
        r["ejecutado"] = datetime.now().isoformat(timespec="seconds")
        resultados.append(r)
        (salida / f"{r['id']}.json").write_text(json.dumps(r, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        print(f"{r['id']}  {r['estado']:<8} {r['escenario']}" + (f"  ← {'; '.join(r['fallidas'])}" if r["fallidas"] else ""))

    totales = {e: sum(1 for r in resultados if r["estado"] == e) for e in ("PASS", "FAIL", "BLOCKED", "NOT RUN")}
    (salida / "resumen.json").write_text(json.dumps({"entorno": info, "totales": totales, "casos": resultados},
                                                    ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    lineas = [f"# Bitácora de ejecución — {info['fecha']}", "",
              f"Rama `{info['rama']}`, commit `{info['commit']}` ({info['commit_mensaje']}). Web {WEB}, Mailpit {MAILPIT}. "
              f"Docker {info['docker']}, Compose {info['compose']}.", "",
              f"Planificados {len(resultados)} · PASS {totales['PASS']} · FAIL {totales['FAIL']} · BLOCKED {totales['BLOCKED']} · NOT RUN {totales['NOT RUN']}", "",
              "| Caso | HU | Esperado | Obtenido | Estado | Evidencia |", "|---|---|---|---|---|---|"]
    for r in resultados:
        lineas.append(f"| {r['id']} | {r['hu']} | {r['esperado']} | {r['obtenido']} | **{r['estado']}** | `{r['id']}.json` |")
    (salida / "bitacora.md").write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"\nPASS {totales['PASS']} · FAIL {totales['FAIL']} · BLOCKED {totales['BLOCKED']} · NOT RUN {totales['NOT RUN']}")
    print(f"Evidencia en {salida.relative_to(RAIZ)}")
    return 1 if totales["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main())
