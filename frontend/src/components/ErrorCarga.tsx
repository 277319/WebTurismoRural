import { RefreshCw, ServerCrash, TriangleAlert, WifiOff } from 'lucide-react'
import { ErrorApi } from '../api/cliente'
import { mensajeDeError } from '../api/errores'

type Props = {
  error: unknown
  /** Título corto, p. ej. "No pudimos cargar el catálogo" */
  titulo: string
  onReintentar?: () => void
}

/** Bloque de error para cuando falla la carga de datos, con botón para reintentar. */
export default function ErrorCarga({ error, titulo, onReintentar }: Props) {
  const api = error instanceof ErrorApi ? error : null
  const Icono =
    api?.tipo === 'conexion' || api?.tipo === 'tiempo' ? WifiOff : api?.status && api.status >= 500 ? ServerCrash : TriangleAlert

  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <Icono className="size-6" aria-hidden />
      </span>
      <h2 className="font-semibold text-stone-800">{titulo}</h2>
      <p className="mt-1 max-w-md text-sm text-stone-600">{mensajeDeError(error)}</p>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-campo-600 px-5 py-2.5 text-base font-semibold text-white shadow transition hover:bg-campo-700"
        >
          <RefreshCw className="size-4" aria-hidden />
          Intentar de nuevo
        </button>
      )}
    </div>
  )
}
