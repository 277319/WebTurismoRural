import { formatearPrecio } from '../api/experiencias'
import type { Pago } from '../api/pagos'
import { esEstadia } from '../api/reservas'
import { desdeIso, formatoFechaLarga } from '../fechas'

/** Qué se está pagando: experiencia, fechas, monto y código de reserva. */
export default function ResumenPago({ pago }: { pago: Pago }) {
  const { reserva } = pago
  const filas: [string, string][] = [
    ['Experiencia', reserva.experiencia.titulo],
    ...(esEstadia(reserva)
      ? ([
          ['Llegada', formatoFechaLarga.format(desdeIso(reserva.fecha))],
          ['Salida', formatoFechaLarga.format(desdeIso(reserva.fecha_salida))],
        ] as [string, string][])
      : ([['Fecha', formatoFechaLarga.format(desdeIso(reserva.fecha))]] as [string, string][])),
    ['Personas', String(reserva.personas)],
    ['Código de reserva', `#${reserva.id}`],
  ]
  return (
    <dl className="space-y-1.5 text-sm">
      {filas.map(([termino, valor]) => (
        <div key={termino} className="flex justify-between gap-4">
          <dt className="text-stone-600">{termino}</dt>
          <dd className="text-right font-medium text-stone-800 first-letter:uppercase">{valor}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-4 border-t border-stone-200 pt-2">
        <dt className="font-semibold text-stone-800">Total</dt>
        <dd className="text-xl font-bold text-campo-700">{formatearPrecio(pago.monto)}</dd>
      </div>
    </dl>
  )
}
