import { useState, type FormEvent } from 'react'
import { ErrorApi } from '../api/cliente'
import { crearEmprendimiento, type Emprendimiento } from '../api/emprendimientos'
import { mensajeDeError } from '../api/errores'
import { useCamposEmprendimiento } from '../hooks/useCamposEmprendimiento'
import { normalizarEmprendimiento } from '../validacion'
import EmprendimientoCampos from './EmprendimientoCampos'

type Props = {
  onCreado: (emprendimiento: Emprendimiento) => void
  onCancelar: () => void
}

/** Alta rápida con los datos básicos; el resto (foto, historia, redes…) se completa al editar. */
export default function EmprendimientoForm({ onCreado, onCancelar }: Props) {
  const campos = useCamposEmprendimiento()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    campos.tocarTodos()
    if (!campos.valido) return

    setEnviando(true)
    setErrorGeneral(null)
    try {
      onCreado(await crearEmprendimiento(normalizarEmprendimiento(campos.valores)))
    } catch (err) {
      if (!(err instanceof ErrorApi && err.campo && campos.errorDeServidor(err.campo, err.message))) {
        setErrorGeneral(mensajeDeError(err))
      }
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-xl border border-campo-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-campo-700">Publicar nuevo emprendimiento</h3>

      <EmprendimientoCampos campos={campos} idPrefijo="nuevo-emp" />

      {errorGeneral && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorGeneral}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onCancelar}
          className="flex-1 rounded-lg border-2 border-stone-500 py-2.5 font-semibold text-stone-700 transition hover:bg-stone-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={enviando}
          className="flex-1 rounded-lg bg-campo-600 py-2.5 font-semibold text-white shadow transition hover:bg-campo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : 'Publicar'}
        </button>
      </div>
    </form>
  )
}
