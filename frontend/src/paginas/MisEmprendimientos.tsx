import { ExternalLink, Paintbrush, Pencil, Plus, Store, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { urlArchivo } from '../api/cliente'
import { eliminarEmprendimiento, misEmprendimientos, type Emprendimiento } from '../api/emprendimientos'
import DialogoEliminar from '../components/DialogoEliminar'
import EmprendimientoForm from '../components/EmprendimientoForm'
import ErrorCarga from '../components/ErrorCarga'
import { useCarga } from '../hooks/useCarga'

export default function MisEmprendimientos() {
  const { datos: emprendimientos, error, cargando, recargar, setDatos } = useCarga(misEmprendimientos, [])
  const [creando, setCreando] = useState(false)
  // Emprendimiento cuya eliminación se está confirmando
  const [aEliminar, setAEliminar] = useState<Emprendimiento | null>(null)

  async function eliminar(emp: Emprendimiento) {
    await eliminarEmprendimiento(emp.id)
    setDatos((lista) => (lista ?? []).filter((e) => e.id !== emp.id))
    setAEliminar(null)
  }

  return (
    <section className="w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-campo-700">Mis emprendimientos</h1>
        {!creando && emprendimientos && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-campo-600 px-5 py-2.5 text-base font-semibold text-white shadow transition hover:bg-campo-700"
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
        <p className="text-stone-600">Cargando…</p>
      ) : emprendimientos.length === 0 && !creando ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
          Aún no tienes emprendimientos publicados.
        </p>
      ) : (
        <ul className="space-y-3">
          {emprendimientos.map((emp) => {
            const foto = urlArchivo(emp.foto_url)
            return (
              <li key={emp.id} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-campo-100 text-campo-500">
                  {foto ? <img src={foto} alt="" loading="lazy" decoding="async" className="size-full object-cover" /> : <Store className="size-7" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-stone-800">{emp.nombre}</h2>
                  <p className="truncate text-sm text-stone-600">
                    {emp.direccion}, {emp.localidad}
                  </p>
                  <p className="text-sm text-stone-600">Contacto: {emp.telefono_contacto}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {(
                    [
                      [`/emprendimientos/${emp.id}/editar`, Pencil, 'Editar'],
                      [`/emprendimientos/${emp.id}/personalizar`, Paintbrush, 'Personalizar'],
                      [`/emprendimientos/${emp.id}`, ExternalLink, 'Ver página'],
                    ] as const
                  ).map(([ruta, Icono, texto]) => (
                    <Link
                      key={texto}
                      to={ruta}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-stone-500 px-4 py-2.5 text-base font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      <Icono className="size-4" aria-hidden />
                      {texto}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAEliminar(emp)}
                    aria-label={`Eliminar «${emp.nombre}»`}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-600 px-4 py-2.5 text-base font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Eliminar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <DialogoEliminar
        abierto={aEliminar !== null}
        titulo="¿Eliminar este emprendimiento?"
        textoConfirmacion={aEliminar?.nombre}
        onEliminar={() => eliminar(aEliminar!)}
        onCerrar={() => setAEliminar(null)}
      >
        <p>
          Se borrará <strong className="font-semibold text-stone-800">«{aEliminar?.nombre}»</strong> con su página pública
          y <strong className="font-semibold text-stone-800">todas sus experiencias y fotos</strong>.
        </p>
        <p>Esta acción no se puede deshacer.</p>
      </DialogoEliminar>
    </section>
  )
}
