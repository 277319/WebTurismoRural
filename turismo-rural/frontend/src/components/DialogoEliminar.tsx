import { LoaderCircle, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { mensajeDeError } from '../api/errores'

type Props = {
  /** Se muestra mientras sea true */
  abierto: boolean
  titulo: string
  children: ReactNode
  /** Si se indica, hay que escribir este texto para habilitar el botón (para borrados con mucho alcance) */
  textoConfirmacion?: string
  onEliminar: () => Promise<void>
  onCerrar: () => void
}

/** Confirmación de un borrado definitivo, en un <dialog> nativo (cierra con Escape y retiene el foco). */
export default function DialogoEliminar({ abierto, titulo, children, textoConfirmacion, onEliminar, onCerrar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [escrito, setEscrito] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (abierto && !d.open) {
      setEscrito('')
      setError(null)
      d.showModal()
    } else if (!abierto && d.open) {
      d.close()
    }
  }, [abierto])

  const confirmado = !textoConfirmacion || escrito.trim() === textoConfirmacion.trim()

  async function eliminar() {
    setEliminando(true)
    setError(null)
    try {
      await onEliminar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEliminando(false)
    }
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="dialogo-eliminar-titulo"
      // Escape y el cierre nativo pasan por aquí; mientras se elimina no se deja cerrar
      onCancel={(e) => {
        e.preventDefault()
        if (!eliminando) onCerrar()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          if (confirmado && !eliminando) eliminar()
        }}
        className="p-5"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <TriangleAlert className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="dialogo-eliminar-titulo" className="text-lg font-semibold text-stone-800">
              {titulo}
            </h2>
            <div className="mt-1 space-y-2 text-sm text-stone-600">{children}</div>
          </div>
        </div>

        {textoConfirmacion && (
          <label className="mt-4 block text-sm text-stone-700">
            Para confirmar, escribe <strong className="font-semibold">{textoConfirmacion}</strong>
            <input
              type="text"
              value={escrito}
              onChange={(e) => setEscrito(e.target.value)}
              disabled={eliminando}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            No se pudo eliminar. {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            disabled={eliminando}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!confirmado || eliminando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {eliminando ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
            {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
