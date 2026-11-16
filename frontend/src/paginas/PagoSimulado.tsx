import { CircleCheck, CircleX, CreditCard, FlaskConical, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { mensajeDeError } from '../api/errores'
import { obtenerPago, simularPago } from '../api/pagos'
import ErrorCarga from '../components/ErrorCarga'
import ResumenPago from '../components/ResumenPago'
import { useCarga } from '../hooks/useCarga'

/**
 * Pasarela de pago simulada (PROVEEDOR_PAGO=simulado): hace las veces de la página del proveedor.
 * El resultado elegido llega al backend como un aviso al webhook, igual que con un proveedor real.
 */
export default function PagoSimulado() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { datos: pago, error, cargando, recargar } = useCarga(() => obtenerPago(id), [id])
  const [enviando, setEnviando] = useState<'aprobar' | 'rechazar' | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  async function resolver(aprobar: boolean) {
    setEnviando(aprobar ? 'aprobar' : 'rechazar')
    setErrorEnvio(null)
    try {
      await simularPago(id, aprobar)
      // Como al volver del proveedor: la página de resultado espera el aviso del webhook
      navigate(`/pagos/${id}/${aprobar ? 'exito' : 'fallo'}`, { replace: true })
    } catch (err) {
      setErrorEnvio(mensajeDeError(err))
      setEnviando(null)
    }
  }

  if (error && !cargando) return <ErrorCarga error={error} titulo="No pudimos cargar el pago" onReintentar={recargar} />
  if (!pago) return <p className="text-stone-600">Cargando…</p>

  return (
    <section className="w-full max-w-md">
      <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
        <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
        Pasarela de prueba: no se cobra dinero real. Elige cómo quieres que termine el pago.
      </p>

      <div className="rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="flex items-center gap-2 text-xl font-bold text-campo-700">
          <CreditCard className="size-6" aria-hidden />
          Pagar reserva
        </h1>
        <div className="mt-4">
          <ResumenPago pago={pago} />
        </div>

        {pago.estado !== 'pendiente' || pago.proveedor !== 'simulado' ? (
          <div className="mt-6 text-sm text-stone-600">
            <p>Este pago ya se procesó.</p>
            <Link to={`/pagos/${pago.id}/exito`} className="mt-2 inline-block font-medium text-campo-600 hover:underline">
              Ver el resultado
            </Link>
          </div>
        ) : (
          <>
            {errorEnvio && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorEnvio}
              </p>
            )}
            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => resolver(true)}
                disabled={enviando !== null}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-campo-600 py-3 font-semibold text-white shadow transition hover:bg-campo-700 disabled:opacity-60"
              >
                {enviando === 'aprobar' ? (
                  <LoaderCircle className="size-5 animate-spin" aria-hidden />
                ) : (
                  <CircleCheck className="size-5" aria-hidden />
                )}
                Simular pago aprobado
              </button>
              <button
                type="button"
                onClick={() => resolver(false)}
                disabled={enviando !== null}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-600 py-3 font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                {enviando === 'rechazar' ? (
                  <LoaderCircle className="size-5 animate-spin" aria-hidden />
                ) : (
                  <CircleX className="size-5" aria-hidden />
                )}
                Simular pago rechazado
              </button>
            </div>
            <Link
              to={`/pagos/${pago.id}/fallo`}
              replace
              className="mt-4 block text-center text-sm font-medium text-stone-600 hover:underline"
            >
              Volver sin pagar
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
