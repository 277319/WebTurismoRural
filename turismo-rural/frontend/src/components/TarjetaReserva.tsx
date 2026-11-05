import type { ReactNode } from 'react'
import { formatearPrecio } from '../api/experiencias'
import { esEstadia, METODOS_PAGO, NOMBRE_ESTADO_RESERVA, type EstadoReserva, type Reserva } from '../api/reservas'
import { desdeIso, formatoDia } from '../fechas'

const ESTILO_ESTADO: Record<EstadoReserva, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  confirmada: 'bg-campo-100 text-campo-700',
  pagada: 'bg-campo-600 text-white',
  cancelada: 'bg-stone-100 text-stone-600',
  rechazada: 'bg-red-50 text-red-700',
}

const formatoDiaSemana = new Intl.DateTimeFormat('es-CL', { weekday: 'short' })
const formatoMesCorto = new Intl.DateTimeFormat('es-CL', {
  month: 'short',
  year: 'numeric',
})

type Props = {
  reserva: Reserva
  /** Línea principal: el título de la experiencia o el nombre del visitante */
  titulo: ReactNode
  /** Datos de contacto u otra información secundaria */
  detalle?: ReactNode
  acciones?: ReactNode
  /** Mensaje de error de la última acción sobre esta reserva */
  error?: string | null
  /** Fecha pasada o cancelada: se muestra atenuada */
  atenuada?: boolean
  /** Qué significa el estado y qué hacer (ver explicacionEstado) */
  explicacion?: string
}

export default function TarjetaReserva({ reserva, titulo, detalle, acciones, error, atenuada, explicacion }: Props) {
  const fecha = desdeIso(reserva.fecha)
  return (
    <li
      className={`flex gap-4 rounded-xl bg-white p-4 shadow-sm ${
        reserva.estado === 'pendiente' && !atenuada ? 'ring-2 ring-amber-500' : ''
      }`}
    >
      <div
        className={`flex w-18 shrink-0 flex-col items-center justify-center rounded-lg py-2 text-center ${
          atenuada ? 'bg-stone-100 text-stone-600' : 'bg-campo-50 text-campo-700'
        }`}
      >
        <span className="text-sm capitalize">{formatoDiaSemana.format(fecha)}</span>
        <span className="text-2xl leading-tight font-bold">{fecha.getDate()}</span>
        <span className="text-xs capitalize">{formatoMesCorto.format(fecha)}</span>
      </div>

      <div className={`min-w-0 flex-1 ${atenuada ? 'opacity-90' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 text-lg font-semibold break-words text-stone-800">{titulo}</div>
          <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${ESTILO_ESTADO[reserva.estado]}`}>
            {NOMBRE_ESTADO_RESERVA[reserva.estado]}
          </span>
        </div>
        {explicacion && <p className="mt-1 text-base text-stone-800">{explicacion}</p>}
        {esEstadia(reserva) && (
          <p className="mt-1 text-base text-stone-700">
            {reserva.noches} {reserva.noches === 1 ? 'noche' : 'noches'} · salida el{' '}
            {formatoDia.format(desdeIso(reserva.fecha_salida))}
          </p>
        )}
        <p className="mt-1 text-base text-stone-700">
          {reserva.personas} {reserva.personas === 1 ? 'persona' : 'personas'} ·{' '}
          <span className="font-medium text-stone-800">{formatearPrecio(reserva.total)}</span>
          {reserva.metodo_pago && ` · ${METODOS_PAGO[reserva.metodo_pago].nombre}`}
        </p>
        {detalle && <div className="mt-1 text-base text-stone-700">{detalle}</div>}
        {acciones && <div className="mt-3 flex flex-wrap gap-2">{acciones}</div>}
        {error && (
          <p role="alert" className="mt-2 text-base font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}

export function SeccionReservas({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-stone-600 uppercase">{titulo}</h2>
      <ul className="space-y-3">{children}</ul>
    </section>
  )
}
