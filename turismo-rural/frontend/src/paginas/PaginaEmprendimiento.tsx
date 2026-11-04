import { Paintbrush, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { obtenerEmprendimiento } from '../api/emprendimientos'
import { useAuth } from '../auth/contexto'
import ErrorCarga from '../components/ErrorCarga'
import FichaEmprendimiento from '../components/FichaEmprendimiento'
import { datosFicha } from '../fichaEmprendimiento'
import { useCarga } from '../hooks/useCarga'

const claseBoton =
  'inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50'

/** Página pública de un emprendimiento, con sus colores y contenidos personalizados. */
export default function PaginaEmprendimiento() {
  const { id } = useParams()
  const emprendimientoId = Number(id)
  const { usuario } = useAuth()
  const { datos, error, cargando, recargar } = useCarga(() => obtenerEmprendimiento(emprendimientoId), [emprendimientoId])

  return (
    <section className="w-full max-w-4xl">
      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar el emprendimiento" onReintentar={recargar} />
      ) : !datos ? (
        <p className="text-stone-500">Cargando…</p>
      ) : (
        <>
          {datos.usuario_id === usuario?.id && (
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <Link to={`/emprendimientos/${datos.id}/editar`} className={claseBoton}>
                <Pencil className="size-4" aria-hidden />
                Editar datos
              </Link>
              <Link to={`/emprendimientos/${datos.id}/personalizar`} className={claseBoton}>
                <Paintbrush className="size-4" aria-hidden />
                Personalizar
              </Link>
            </div>
          )}
          <FichaEmprendimiento datos={datosFicha(datos)} />
        </>
      )}
    </section>
  )
}
