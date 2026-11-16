import { CircleCheck, CircleX, Clock, LoaderCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { mensajeDeError } from '../api/errores'
import { irAPagar, obtenerPago, type Pago } from '../api/pagos'
import { sePuedePagarEnLinea } from '../api/reservas'
import ErrorCarga from '../components/ErrorCarga'
import ResumenPago from '../components/ResumenPago'
import { useCarga } from '../hooks/useCarga'

// El aviso del proveedor suele llegar en segundos: se consulta cada 1,5 s durante unos 30 s
const INTERVALO_MS = 1500
const MAX_CONSULTAS = 20

/**
 * Página a la que vuelve el visitante desde el proveedor. La ruta dice cómo terminó en el proveedor,
 * pero lo que vale es el estado del pago en el backend, que cambia cuando llega el aviso al webhook.
 */
export default function ResultadoPago({ resultado }: { resultado: 'exito' | 'fallo' }) {
  const id = Number(useParams().id)
  const { datos: pago, error, cargando, recargar } = useCarga(() => obtenerPago(id), [id])
  const [consultas, setConsultas] = useState(0)

  // Volvió del proveedor diciendo que pagó, pero el aviso aún no llega: se espera
  const esperando = resultado === 'exito' && pago?.estado === 'pendiente' && consultas < MAX_CONSULTAS
  useEffect(() => {
    if (!esperando || cargando) return
    const temporizador = setTimeout(() => {
      setConsultas((n) => n + 1)
      recargar()
    }, INTERVALO_MS)
    return () => clearTimeout(temporizador)
  }, [esperando, cargando, recargar])

  if (error && !pago && !cargando) {
    return <ErrorCarga error={error} titulo="No pudimos cargar el pago" onReintentar={recargar} />
  }
  if (!pago) return <p className="text-stone-600">Cargando…</p>

  if (pago.estado === 'aprobado') {
    return (
      <Resultado
        pago={pago}
        icono={<CircleCheck className="size-7" aria-hidden />}
        color="bg-campo-100 text-campo-700"
        titulo="¡Pago exitoso!"
        texto="Tu reserva quedó pagada. Te enviamos el comprobante por correo."
      />
    )
  }
  if (esperando) {
    return (
      <Resultado
        pago={pago}
        icono={<LoaderCircle className="size-7 animate-spin" aria-hidden />}
        color="bg-stone-100 text-stone-600"
        titulo="Confirmando tu pago…"
        texto="Estamos esperando la confirmación del medio de pago. No cierres esta página."
      />
    )
  }
  if (resultado === 'exito' && pago.estado === 'pendiente') {
    return (
      <Resultado
        pago={pago}
        icono={<Clock className="size-7" aria-hidden />}
        color="bg-amber-100 text-amber-700"
        titulo="Tu pago se está procesando"
        texto="El medio de pago aún no lo confirma. Te avisaremos por correo apenas se apruebe; no vuelvas a pagar mientras tanto."
      />
    )
  }
  return (
    <Resultado
      pago={pago}
      icono={<CircleX className="size-7" aria-hidden />}
      color="bg-red-100 text-red-600"
      titulo="El pago no se completó"
      texto={
        sePuedePagarEnLinea(pago.reserva)
          ? 'No se hizo ningún cobro. Tu reserva sigue confirmada: puedes intentarlo de nuevo o pagar directamente al anfitrión.'
          : 'No se hizo ningún cobro.'
      }
      reintentar
    />
  )
}

type PropsResultado = {
  pago: Pago
  icono: ReactNode
  /** Clases del círculo del ícono */
  color: string
  titulo: string
  texto: string
  /** Ofrece volver a pagar (si la reserva todavía se puede pagar) */
  reintentar?: boolean
}

function Resultado({ pago, icono, color, titulo, texto, reintentar }: PropsResultado) {
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pagarDeNuevo() {
    setAbriendo(true)
    setError(null)
    try {
      await irAPagar(pago.reserva_id)
    } catch (err) {
      setError(mensajeDeError(err))
      setAbriendo(false)
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg">
      <span className={`mx-auto flex size-14 items-center justify-center rounded-full ${color}`}>{icono}</span>
      <h1 role="status" className="mt-3 text-2xl font-bold text-stone-800">
        {titulo}
      </h1>
      <p className="mt-1 text-sm text-stone-600">{texto}</p>

      <div className="mt-5 rounded-xl bg-stone-50 p-4 text-left">
        <ResumenPago pago={pago} />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-col gap-2">
        {reintentar && sePuedePagarEnLinea(pago.reserva) && (
          <button
            type="button"
            onClick={pagarDeNuevo}
            disabled={abriendo}
            className="flex items-center justify-center gap-2 rounded-lg bg-campo-600 py-2.5 font-semibold text-white shadow transition hover:bg-campo-700 disabled:opacity-60"
          >
            {abriendo ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <RefreshCw className="size-5" aria-hidden />}
            {abriendo ? 'Abriendo el pago…' : 'Intentar de nuevo'}
          </button>
        )}
        <Link
          to="/mis-reservas"
          className={
            reintentar
              ? 'py-2 text-sm font-medium text-campo-600 hover:underline'
              : 'rounded-lg bg-campo-600 py-2.5 font-semibold text-white shadow transition hover:bg-campo-700'
          }
        >
          Ver mis reservas
        </Link>
      </div>
    </section>
  )
}
