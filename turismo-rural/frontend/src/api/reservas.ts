import { apiFetch, errorDesdeRespuesta } from './cliente'
import type { TipoExperiencia } from './experiencias'

export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'en_linea'
export type EstadoReserva = 'pendiente' | 'confirmada' | 'pagada' | 'cancelada' | 'rechazada'

export const METODOS_PAGO: Record<MetodoPago, { nombre: string; descripcion: string }> = {
  efectivo: { nombre: 'Efectivo al llegar', descripcion: 'Pagas en el lugar' },
  transferencia: {
    nombre: 'Transferencia bancaria',
    descripcion: 'El anfitrión te enviará sus datos',
  },
  tarjeta: {
    nombre: 'Tarjeta al llegar',
    descripcion: 'Pagas en el lugar, con débito o crédito',
  },
  en_linea: {
    nombre: 'Pago en línea',
    descripcion: 'Pagas con tarjeta en la web cuando el anfitrión confirme',
  },
}

/** Confirmada y con precio: el visitante puede pagarla en línea (aunque al reservar eligiera otro método) */
export const sePuedePagarEnLinea = (r: Pick<Reserva, 'estado' | 'total'>) => r.estado === 'confirmada' && r.total > 0

export const NOMBRE_ESTADO_RESERVA: Record<EstadoReserva, string> = {
  pendiente: 'Pendiente de confirmación',
  confirmada: 'Confirmada',
  pagada: 'Pagada',
  cancelada: 'Cancelada',
  rechazada: 'Rechazada',
}

/** Máximo de noches por reserva (MAX_NOCHES del backend) */
export const MAX_NOCHES = 30

/** Se muestra con llegada y salida: los hospedajes (también si la experiencia dejó de serlo después de reservar) */
export const esEstadia = (r: Pick<Reserva, 'noches' | 'experiencia'>) => r.experiencia.tipo === 'hospedaje' || r.noches > 1

/** Qué significa el estado de la reserva y qué hacer, en palabras simples, para quien la mira */
export function explicacionEstado(r: Pick<Reserva, 'estado' | 'total'>, para: 'visitante' | 'anfitrion'): string {
  if (para === 'visitante') {
    switch (r.estado) {
      case 'pendiente':
        return 'El anfitrión todavía no responde. Te avisaremos por correo cuando confirme.'
      case 'confirmada':
        return r.total > 0 ? 'El anfitrión te espera. Falta pagar: en línea aquí, o como elegiste al reservar.' : 'El anfitrión te espera.'
      case 'pagada':
        return 'Pago recibido. ¡Todo listo!'
      case 'cancelada':
        return 'Esta reserva se canceló. No tienes que hacer nada más.'
      case 'rechazada':
        return 'El anfitrión no puede recibirte en esa fecha. Puedes reservar otra.'
    }
  }
  switch (r.estado) {
    case 'pendiente':
      return 'Responde: «Confirmar» si puedes recibirlos, «Rechazar» si no. Le avisamos al visitante por correo.'
    case 'confirmada':
      return r.total > 0 ? 'Cuando te paguen, toca «Marcar como pagada».' : 'Todo listo: el visitante sabe que lo esperas.'
    case 'pagada':
      return 'Pagada. No falta nada.'
    case 'cancelada':
      return 'Cancelada: sus cupos volvieron a quedar libres.'
    case 'rechazada':
      return 'La rechazaste: sus cupos quedaron libres.'
  }
}

/** Ya no ocupan cupos */
export const esCerrada = (r: Pick<Reserva, 'estado'>) => r.estado === 'cancelada' || r.estado === 'rechazada'

export type DatosReserva = {
  experiencia_id: number
  /** 'YYYY-MM-DD'. En un hospedaje, el día de llegada */
  fecha: string
  /** Noches seguidas desde `fecha`; más de 1 solo en los hospedajes */
  noches: number
  personas: number
  /** Obligatorio si la experiencia tiene precio; en las gratuitas se omite */
  metodo_pago: MetodoPago | null
}

export type Reserva = Omit<DatosReserva, 'metodo_pago'> & {
  id: number
  /** 'YYYY-MM-DD': el día siguiente a la última noche */
  fecha_salida: string
  experiencia: {
    id: number
    tipo: TipoExperiencia
    titulo: string
    localidad: string
    emprendimiento: { id: number; nombre: string; telefono_contacto: string }
  }
  /** Precio vigente al reservar */
  precio_por_persona: number
  /** Calculado por el backend */
  total: number
  estado: EstadoReserva
  metodo_pago: MetodoPago | null
  fecha_creacion: string
}

/** Lo que ve el anfitrión: incluye el contacto del visitante */
export type ReservaAnfitrion = Reserva & {
  visitante: {
    id: number
    nombre: string | null
    correo: string | null
    telefono: string | null
  }
}

/** Separa las reservas en próximas, pasadas y canceladas o rechazadas (cada grupo en el orden más útil) */
export function agruparReservas<T extends Reserva>(reservas: T[], hoy: string) {
  const asc = (a: T, b: T) => a.fecha.localeCompare(b.fecha) || a.id - b.id
  const desc = (a: T, b: T) => -asc(a, b)
  const activas = reservas.filter((r) => !esCerrada(r))
  return {
    proximas: activas.filter((r) => r.fecha >= hoy).sort(asc),
    pasadas: activas.filter((r) => r.fecha < hoy).sort(desc),
    canceladas: reservas.filter(esCerrada).sort(desc),
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorDesdeRespuesta(res)
  return res.json()
}

/** Reserva la fecha y descuenta sus cupos. 409 si ya no quedan suficientes. */
export async function crearReserva(datos: DatosReserva): Promise<Reserva> {
  return json(
    await apiFetch('/reservas', {
      method: 'POST',
      body: JSON.stringify(datos),
    }),
  )
}

/** Reservas hechas por el usuario en sesión. */
export async function misReservas(): Promise<Reserva[]> {
  return json(await apiFetch('/reservas/mias'))
}

/** Reservas de una experiencia propia (solo su anfitrión). */
export async function reservasDeExperiencia(experienciaId: number): Promise<ReservaAnfitrion[]> {
  return json(await apiFetch(`/experiencias/${experienciaId}/reservas`))
}

/** La cancela el visitante o el anfitrión; los cupos vuelven a quedar libres. */
export async function cancelarReserva(id: number): Promise<Reserva> {
  return json(await apiFetch(`/reservas/${id}/cancelar`, { method: 'PATCH' }))
}

/** El anfitrión confirma una reserva pendiente. Se avisa al visitante por correo. */
export async function confirmarReserva(id: number): Promise<Reserva> {
  return json(await apiFetch(`/reservas/${id}/confirmar`, { method: 'PATCH' }))
}

/** El anfitrión rechaza una solicitud pendiente; sus cupos quedan libres y se avisa al visitante. */
export async function rechazarReserva(id: number): Promise<Reserva> {
  return json(await apiFetch(`/reservas/${id}/rechazar`, { method: 'PATCH' }))
}

/** El anfitrión registra el pago de una reserva confirmada. Se avisa al visitante por correo. */
export async function marcarReservaPagada(id: number): Promise<Reserva> {
  return json(await apiFetch(`/reservas/${id}/marcar-pagada`, { method: 'PATCH' }))
}
