import { BellRing, CalendarDays, ClipboardList, Eye, Images, LoaderCircle, MapPin, Pause, Pencil, Play, Plus, Sparkles, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { urlArchivo } from '../api/cliente'
import { mensajeDeError } from '../api/errores'
import {
  cambiarEstadoExperiencia,
  eliminarExperiencia,
  formatearPrecio,
  MAX_FOTOS_EXPERIENCIA,
  misExperiencias,
  type Experiencia,
  type ExperienciaPropia,
} from '../api/experiencias'
import DialogoEliminar from '../components/DialogoEliminar'
import ErrorCarga from '../components/ErrorCarga'
import { useCarga } from '../hooks/useCarga'
import { tipoExperiencia, unidadPrecio } from '../tiposExperiencia'

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
      // La respuesta no trae reservas_pendientes: se conserva el conteo que ya teníamos
      setDatos((lista) => (lista ?? []).map((e) => (e.id === actualizada.id ? { ...e, ...actualizada } : e)))
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

  // Experiencia cuya eliminación se está confirmando
  const [aEliminar, setAEliminar] = useState<Experiencia | null>(null)

  async function eliminar(exp: Experiencia) {
    await eliminarExperiencia(exp.id)
    setDatos((lista) => (lista ?? []).filter((e) => e.id !== exp.id))
    setAEliminar(null)
  }

  return (
    <section className="w-full max-w-3xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-campo-700">Mis experiencias</h1>
        <Link
          to="/experiencias/nueva"
          className="inline-flex items-center gap-1.5 rounded-lg bg-campo-600 px-5 py-2.5 text-base font-semibold text-white shadow transition hover:bg-campo-700"
        >
          <Plus className="size-5" aria-hidden />
          Publicar experiencia
        </Link>
      </div>
      <details className="mb-6 rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-base text-stone-700">
        <summary className="cursor-pointer text-lg font-semibold text-campo-700">¿Qué hace cada botón?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>
            <strong>Ver reservas</strong>: quiénes reservaron. Ahí confirmas o rechazas cada solicitud.
          </li>
          <li>
            <strong>Fechas y cupos</strong>: los días en que ofreces la experiencia y cuántas personas recibes.
          </li>
          <li>
            <strong>Fotos</strong>: sube hasta {MAX_FOTOS_EXPERIENCIA} fotos; la primera es la principal.
          </li>
          <li>
            <strong>Editar datos</strong>: título, descripción, precio y lugar.
          </li>
          <li>
            <strong>Pausar (ocultar)</strong>: deja de aparecer en el catálogo, sin borrarla. «Reanudar» la vuelve a mostrar.
          </li>
          <li>
            <strong>Eliminar</strong>: la borra para siempre, con sus fotos.
          </li>
        </ul>
      </details>

      {experiencias && <AvisoPendientes experiencias={experiencias} />}

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar tus experiencias" onReintentar={recargar} />
      ) : !experiencias ? (
        <p className="text-stone-600">Cargando…</p>
      ) : experiencias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center">
          <p className="text-lg text-stone-700">Aún no has publicado experiencias.</p>
          <Link
            to="/experiencias/nueva"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-campo-600 px-5 py-3 text-base font-semibold text-white shadow transition hover:bg-campo-700"
          >
            <Plus className="size-5" aria-hidden />
            Publicar mi primera experiencia
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {experiencias.map((exp) => {
            const { Icono, nombre: nombreTipo } = tipoExperiencia(exp.tipo)
            const esNueva = exp.id === nuevaId
            const activa = exp.estado === 'activo'
            const enCurso = cambiando.has(exp.id)
            const pendientes = exp.reservas_pendientes
            return (
              <li
                key={exp.id}
                id={`experiencia-${exp.id}`}
                className={`flex scroll-mt-4 gap-4 rounded-xl bg-white p-4 shadow-sm ${
                  esNueva ? 'ring-2 ring-campo-500' : pendientes > 0 ? 'ring-2 ring-amber-300' : ''
                }`}
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
                      activa ? 'bg-campo-100 text-campo-600' : 'bg-stone-100 text-stone-500'
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
                      className={`rounded-full px-2 py-0.5 text-sm font-medium ${
                        activa ? 'bg-campo-100 text-campo-700' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {activa ? 'Activa' : 'Pausada · oculta en el catálogo'}
                    </span>
                    {esNueva && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800">
                        <Sparkles className="size-4" aria-hidden />
                        Recién publicada
                      </span>
                    )}
                    {pendientes > 0 && (
                      <Link
                        to={`/experiencias/${exp.id}/reservas`}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-200"
                      >
                        <BellRing className="size-4" aria-hidden />
                        {pendientes} {pendientes === 1 ? 'reserva por confirmar' : 'reservas por confirmar'}
                      </Link>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-stone-600">
                    {nombreTipo} · {exp.emprendimiento.nombre}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
                    <span className="font-semibold text-campo-700">
                      {formatearPrecio(exp.precio_por_persona)}
                      {exp.precio_por_persona > 0 && (
                        <span className="font-normal text-stone-600"> {unidadPrecio(exp.tipo)}</span>
                      )}
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
                      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-base font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                        activa
                          ? 'border-2 border-stone-500 text-stone-700 hover:bg-stone-50'
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
                      {enCurso ? (activa ? 'Pausando…' : 'Reanudando…') : activa ? 'Pausar (ocultar)' : 'Reanudar (mostrar)'}
                    </button>
                    <Link
                      to={`/experiencias/${exp.id}/editar`}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-stone-500 px-4 py-2.5 text-base font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      <Pencil className="size-4" aria-hidden />
                      Editar datos
                    </Link>
                    <Link
                      to={`/experiencias/${exp.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-stone-500 px-4 py-2.5 text-base font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      <Eye className="size-4" aria-hidden />
                      Ver como visitante
                    </Link>
                    <Link
                      to={`/experiencias/${exp.id}/galeria`}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-stone-500 px-4 py-2.5 text-base font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      <Images className="size-4" aria-hidden />
                      {exp.fotos.length === 0 ? 'Agregar fotos' : `Fotos (${exp.fotos.length} de ${MAX_FOTOS_EXPERIENCIA})`}
                    </Link>
                    <Link
                      to={`/experiencias/${exp.id}/disponibilidad`}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-stone-500 px-4 py-2.5 text-base font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      <CalendarDays className="size-4" aria-hidden />
                      Fechas y cupos
                    </Link>
                    <Link
                      to={`/experiencias/${exp.id}/reservas`}
                      className={`relative inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-base font-semibold transition ${
                        pendientes > 0
                          ? 'border-2 border-amber-600 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'border-2 border-stone-500 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <ClipboardList className="size-4" aria-hidden />
                      Ver reservas
                      {pendientes > 0 && (
                        <span className="absolute -top-2 -right-2 flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-sm font-bold text-white">
                          {pendientes}
                        </span>
                      )}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setAEliminar(exp)}
                      aria-label={`Eliminar «${exp.titulo}»`}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-600 px-4 py-2.5 text-base font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Eliminar
                    </button>
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

      <DialogoEliminar
        abierto={aEliminar !== null}
        titulo="¿Eliminar esta experiencia?"
        onEliminar={() => eliminar(aEliminar!)}
        onCerrar={() => setAEliminar(null)}
      >
        <p>
          Se borrará <strong className="font-semibold text-stone-800">«{aEliminar?.titulo}»</strong>
          {aEliminar && aEliminar.fotos.length === 1 && ' junto con su foto'}
          {aEliminar && aEliminar.fotos.length > 1 && ` junto con sus ${aEliminar.fotos.length} fotos`}. Esta acción no se
          puede deshacer.
        </p>
        <p>Si solo quieres ocultarla un tiempo, usa «Pausar».</p>
      </DialogoEliminar>
    </section>
  )
}

/** Banner con el total de reservas que esperan confirmación, y a qué experiencias pertenecen */
function AvisoPendientes({ experiencias }: { experiencias: ExperienciaPropia[] }) {
  const conPendientes = experiencias.filter((e) => e.reservas_pendientes > 0)
  const total = conPendientes.reduce((suma, e) => suma + e.reservas_pendientes, 0)
  if (total === 0) return null

  return (
    <div role="status" className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <BellRing className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-amber-900">
          Tienes {total} {total === 1 ? 'reserva nueva por confirmar' : 'reservas nuevas por confirmar'}
        </p>
        <p className="mt-0.5 text-sm text-amber-800">Confírmalas para que los visitantes sepan que los esperas.</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {conPendientes.map((e) => (
            <li key={e.id}>
              <Link
                to={`/experiencias/${e.id}/reservas`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-base font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
              >
                {e.titulo}
                <span className="rounded-full bg-amber-500 px-1.5 text-sm font-bold text-white">{e.reservas_pendientes}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
