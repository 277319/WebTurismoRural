import { MapPin, Plus, Sparkles, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { formatearPrecio, misExperiencias } from '../api/experiencias'
import ErrorCarga from '../components/ErrorCarga'
import { useCarga } from '../hooks/useCarga'
import { tipoExperiencia } from '../tiposExperiencia'

export default function MisExperiencias() {
  const { datos: experiencias, error, cargando, recargar } = useCarga(misExperiencias, [])
  const location = useLocation()
  const navigate = useNavigate()
  // id de la experiencia recién publicada (llega desde "Publicar experiencia")
  const [nuevaId] = useState(() => (location.state as { nueva?: number } | null)?.nueva ?? null)

  // Limpia el estado de navegación para que el resaltado no reaparezca al recargar
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  return (
    <section className="w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-campo-700">Mis experiencias</h1>
        <Link
          to="/experiencias/nueva"
          className="inline-flex items-center gap-1.5 rounded-lg bg-campo-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-campo-700"
        >
          <Plus className="size-4" aria-hidden />
          Nueva experiencia
        </Link>
      </div>

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar tus experiencias" onReintentar={recargar} />
      ) : !experiencias ? (
        <p className="text-stone-500">Cargando…</p>
      ) : experiencias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center">
          <p className="text-stone-600">Aún no has publicado experiencias.</p>
          <Link to="/experiencias/nueva" className="mt-2 inline-block font-medium text-campo-600 hover:underline">
            Publica la primera
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {experiencias.map((exp) => {
            const { Icono, nombre: nombreTipo } = tipoExperiencia(exp.tipo)
            const esNueva = exp.id === nuevaId
            return (
              <li
                key={exp.id}
                className={`flex gap-4 rounded-xl bg-white p-4 shadow-sm ${esNueva ? 'ring-2 ring-campo-500' : ''}`}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-campo-100 text-campo-600" title={nombreTipo}>
                  <Icono className="size-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-stone-800">{exp.titulo}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        exp.estado === 'activo' ? 'bg-campo-100 text-campo-700' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {exp.estado === 'activo' ? 'Activa' : 'Pausada'}
                    </span>
                    {esNueva && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        <Sparkles className="size-3" aria-hidden />
                        Recién publicada
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {nombreTipo} · {exp.emprendimiento.nombre}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
                    <span className="font-semibold text-campo-700">
                      {formatearPrecio(exp.precio_por_persona)}
                      {exp.precio_por_persona > 0 && <span className="font-normal text-stone-500"> / persona</span>}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-4" aria-hidden />
                      Hasta {exp.capacidad_maxima}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-4" aria-hidden />
                      {exp.localidad}
                    </span>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
