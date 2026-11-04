import { Images, LoaderCircle, MapPin, Pause, Pencil, Play, Plus, Sparkles, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { urlArchivo } from '../api/cliente'
import { mensajeDeError } from '../api/errores'
import {
  cambiarEstadoExperiencia,
  formatearPrecio,
  MAX_FOTOS_EXPERIENCIA,
  misExperiencias,
  type Experiencia,
} from '../api/experiencias'
import ErrorCarga from '../components/ErrorCarga'
import { useCarga } from '../hooks/useCarga'
import { tipoExperiencia } from '../tiposExperiencia'

export default function MisExperiencias() {
  const { datos: experiencias, error, cargando, recargar, setDatos } = useCarga(misExperiencias, [])
  const location = useLocation()
  const navigate = useNavigate()
  // id de la experiencia recién publicada (llega desde "Publicar experiencia")
  const [nuevaId] = useState(() => (location.state as { nueva?: number } | null)?.nueva ?? null)

  // Limpia el estado de navegación para que el resaltado no reaparezca al recargar
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  // Pausar / reanudar: ids con el cambio en curso y errores por experiencia
  const [cambiando, setCambiando] = useState<Set<number>>(() => new Set())
  const [erroresEstado, setErroresEstado] = useState<Record<number, string>>({})

  async function alternarEstado(exp: Experiencia) {
    setCambiando((c) => new Set(c).add(exp.id))
    setErroresEstado((e) => {
      const resto = { ...e }
      delete resto[exp.id]
      return resto
    })
    try {
      const actualizada = await cambiarEstadoExperiencia(exp.id, exp.estado === 'activo' ? 'pausado' : 'activo')
      setDatos((lista) => (lista ?? []).map((e) => (e.id === actualizada.id ? actualizada : e)))
    } catch (err) {
      setErroresEstado((e) => ({ ...e, [exp.id]: mensajeDeError(err) }))
    } finally {
      setCambiando((c) => {
        const siguiente = new Set(c)
        siguiente.delete(exp.id)
        return siguiente
      })
    }
  }

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
            const activa = exp.estado === 'activo'
            const enCurso = cambiando.has(exp.id)
            return (
              <li
                key={exp.id}
                className={`flex gap-4 rounded-xl bg-white p-4 shadow-sm ${esNueva ? 'ring-2 ring-campo-500' : ''}`}
              >
                {exp.fotos.length > 0 ? (
                  <img
                    src={urlArchivo(exp.fotos[0].url) ?? undefined}
                    alt=""
                    loading="lazy"
                    className={`size-16 shrink-0 rounded-lg object-cover ${activa ? '' : 'opacity-50 grayscale'}`}
                  />
                ) : (
                  <span
                    className={`flex size-16 shrink-0 items-center justify-center rounded-lg ${
                      activa ? 'bg-campo-100 text-campo-600' : 'bg-stone-100 text-stone-400'
                    }`}
                    title={nombreTipo}
                  >
                    <Icono className="size-7" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-stone-800">{exp.titulo}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        activa ? 'bg-campo-100 text-campo-700' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {activa ? 'Activa' : 'Pausada · oculta en el catálogo'}
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => alternarEstado(exp)}
                      disabled={enCurso}
                      aria-label={`${activa ? 'Pausar' : 'Reanudar'} «${exp.titulo}»`}
                      title={activa ? 'Ocultarla del catálogo' : 'Volver a mostrarla en el catálogo'}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60 ${
                        activa
                          ? 'border border-stone-300 text-stone-700 hover:bg-stone-50'
                          : 'bg-campo-600 text-white shadow hover:bg-campo-700'
                      }`}
                    >
                      {enCurso ? (
                        <LoaderCircle className="size-4 animate-spin" aria-hidden />
                      ) : activa ? (
                        <Pause className="size-4" aria-hidden />
                      ) : (
                        <Play className="size-4" aria-hidden />
                      )}
                      {enCurso ? (activa ? 'Pausando…' : 'Reanudando…') : activa ? 'Pausar' : 'Reanudar'}
                    </button>
                    <Link
                      to={`/experiencias/${exp.id}/editar`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                    >
                      <Pencil className="size-4" aria-hidden />
                      Editar
                    </Link>
                    <Link
                      to={`/experiencias/${exp.id}/galeria`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                    >
                      <Images className="size-4" aria-hidden />
                      {exp.fotos.length === 0 ? 'Agregar galería de fotos' : `Galería (${exp.fotos.length}/${MAX_FOTOS_EXPERIENCIA})`}
                    </Link>
                  </div>
                  {erroresEstado[exp.id] && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                      No se pudo {activa ? 'pausar' : 'reanudar'} la experiencia. {erroresEstado[exp.id]}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
