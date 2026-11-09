"""Correos que avisan al visitante (y al anfitrión, en las solicitudes nuevas) cada cambio de su reserva."""

from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import BackgroundTasks

from app.core.config import settings
from app.core.correo import programar_correo
from app.models.experiencia import TipoExperiencia
from app.models.reserva import MetodoPago, Reserva

DIAS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
MESES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)

# Mismos textos que el formulario de reserva del frontend
METODOS_PAGO: dict[MetodoPago, tuple[str, str]] = {
    MetodoPago.efectivo: ("Efectivo al llegar", "Pagas en el lugar"),
    MetodoPago.transferencia: ("Transferencia bancaria", "El anfitrión te enviará sus datos"),
    MetodoPago.tarjeta: ("Tarjeta al llegar", "Pagas en el lugar, con débito o crédito"),
    MetodoPago.en_linea: ("Pago en línea", "Pagas con tarjeta en la web, desde Mis reservas, cuando el anfitrión confirme"),
}


def fecha_larga(fecha: date) -> str:
    """'sábado 14 de noviembre de 2026', sin depender del locale del servidor."""
    return f"{DIAS[fecha.weekday()]} {fecha.day} de {MESES[fecha.month - 1]} de {fecha.year}"


def precio(valor: Decimal) -> str:
    """'$15.000' o 'Gratis', igual que formatearPrecio del frontend."""
    if valor == 0:
        return "Gratis"
    entero = f"{valor:,.0f}" if valor == valor.to_integral_value() else f"{valor:,.2f}"
    # Separadores chilenos: punto para miles y coma para decimales
    return "$" + entero.replace(",", "_").replace(".", ",").replace("_", ".")


def datos_reserva(reserva: Reserva) -> dict[str, Any]:
    """Lo que muestran todas las plantillas, como valores simples para la tarea en segundo plano."""
    experiencia = reserva.experiencia
    emprendimiento = experiencia.emprendimiento
    metodo = METODOS_PAGO.get(reserva.metodo_pago) if reserva.metodo_pago else None
    # También si la experiencia dejó de ser hospedaje después de reservar varias noches
    por_noches = experiencia.tipo == TipoExperiencia.hospedaje or reserva.noches > 1
    return {
        "codigo": reserva.id,
        "visitante": reserva.visitante.nombre,
        "experiencia": experiencia.titulo,
        "localidad": experiencia.localidad,
        "emprendimiento": emprendimiento.nombre,
        "telefono_anfitrion": emprendimiento.telefono_contacto,
        "fecha": fecha_larga(reserva.fecha),
        # Solo en los hospedajes: el día de salida y cuántas noches son
        "salida": fecha_larga(reserva.fecha_salida) if por_noches else None,
        "noches": reserva.noches,
        "personas": reserva.personas,
        "total": precio(reserva.total),
        "gratuita": reserva.total == 0,
        "metodo_pago": metodo[0] if metodo else None,
        "indicacion_pago": metodo[1] if metodo else None,
        "url_mis_reservas": f"{settings.FRONTEND_URL}/mis-reservas",
        "url_experiencia": f"{settings.FRONTEND_URL}/experiencias/{experiencia.id}",
    }


def correo_visitante(reserva: Reserva) -> str | None:
    """El correo indicado al reservar; en las reservas anteriores a ese campo, el de la cuenta."""
    return reserva.correo or reserva.visitante.correo


def avisar_nueva_solicitud(tareas: BackgroundTasks, reserva: Reserva) -> None:
    """Acuse al visitante y aviso al anfitrión, que tiene que confirmarla o rechazarla."""
    datos = datos_reserva(reserva)
    programar_correo(
        tareas,
        correo_visitante(reserva),
        f"Recibimos tu solicitud para {datos['experiencia']}",
        "nueva_solicitud.html",
        para_anfitrion=False,
        **datos,
    )
    anfitrion = reserva.experiencia.emprendimiento.usuario
    programar_correo(
        tareas,
        anfitrion.correo,
        f"Nueva solicitud de reserva: {datos['experiencia']}",
        "nueva_solicitud.html",
        para_anfitrion=True,
        anfitrion=anfitrion.nombre,
        contacto_visitante=correo_visitante(reserva) or reserva.visitante.telefono,
        url_reservas_experiencia=f"{settings.FRONTEND_URL}/experiencias/{reserva.experiencia_id}/reservas",
        **datos,
    )


def avisar_confirmada(tareas: BackgroundTasks, reserva: Reserva) -> None:
    datos = datos_reserva(reserva)
    programar_correo(
        tareas,
        correo_visitante(reserva),
        f"¡Tu reserva está confirmada! {datos['experiencia']}",
        "reserva_confirmada.html",
        **datos,
    )


def avisar_rechazada(tareas: BackgroundTasks, reserva: Reserva) -> None:
    datos = datos_reserva(reserva)
    programar_correo(
        tareas,
        correo_visitante(reserva),
        f"Tu solicitud para {datos['experiencia']} no fue aceptada",
        "reserva_rechazada.html",
        **datos,
    )


def avisar_pagada(tareas: BackgroundTasks, reserva: Reserva) -> None:
    datos = datos_reserva(reserva)
    programar_correo(
        tareas,
        correo_visitante(reserva),
        f"Pago recibido: {datos['experiencia']}",
        "reserva_pagada.html",
        **datos,
    )
