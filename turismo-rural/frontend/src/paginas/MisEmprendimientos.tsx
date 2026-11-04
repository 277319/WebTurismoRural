import { Pencil, Plus, Store } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { urlArchivo } from '../api/cliente'
import { misEmprendimientos } from '../api/emprendimientos'
import EmprendimientoForm from '../components/EmprendimientoForm'
import ErrorCarga from '../components/ErrorCarga'
import { useCarga } from '../hooks/useCarga'

export default function MisEmprendimientos() {
  const { datos: emprendimientos, error, cargando, recargar, setDatos } = useCarga(misEmprendimientos, [])
  const [creando, setCreando] = useState(false)

  return (
    <section className="w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-campo-700">Mis emprendimientos</h1>
        {!creando && emprendimientos && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-campo-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-campo-700"
          >
            <Plus className="size-4" aria-hidden />
            Publicar nuevo
          </button>
        )}
      </div>

      {creando && (
        <div className="mb-4">
          <EmprendimientoForm
            onCreado={(nuevo) => {
              setDatos((lista) => [nuevo, ...(lista ?? [])])
              setCreando(false)
            }}
            onCancelar={() => setCreando(false)}
          />
        </div>
      )}

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar tus emprendimientos" onReintentar={recargar} />
      ) : !emprendimientos ? (
        <p className="text-stone-500">Cargando…</p>
      ) : emprendimientos.length === 0 && !creando ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-500">
          Aún no tienes emprendimientos publicados.
        </p>
      ) : (
        <ul className="space-y-3">
          {emprendimientos.map((emp) => {
            const foto = urlArchivo(emp.foto_url)
            return (
              <li key={emp.id} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-campo-100 text-campo-500">
                  {foto ? <img src={foto} alt="" className="size-full object-cover" /> : <Store className="size-7" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-stone-800">{emp.nombre}</h2>
                  <p className="truncate text-sm text-stone-600">
                    {emp.direccion}, {emp.localidad}
                  </p>
                  <p className="text-sm text-stone-500">Contacto: {emp.telefono_contacto}</p>
                </div>
                <Link
                  to={`/emprendimientos/${emp.id}/editar`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  <Pencil className="size-4" aria-hidden />
                  Editar
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
