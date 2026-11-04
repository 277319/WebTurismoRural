import { ArrowLeft, ExternalLink, Images, MapPin, Navigation, Pause, Pencil, Phone, Store, Users } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ErrorApi, urlArchivo } from '../api/cliente'
import { formatearPrecio, obtenerExperiencia, type ExperienciaDetalle } from '../api/experiencias'
import { useAuth } from '../auth/contexto'
import ErrorCarga from '../components/ErrorCarga'
import GaleriaFotos from '../components/GaleriaFotos'
import { useCarga } from '../hooks/useCarga'
import { REDES_INFO } from '../redes'
import { tipoExperiencia } from '../tiposExperiencia'
import { CAMPOS_REDES, enlaceRed } from '../validacion'

// Leaflet pesa ~150 kB: se descarga solo al abrir una experiencia que tenga mapa
const MapaUbicacion = lazy(() => import('../components/MapaUbicacion'))

export default function DetalleExperiencia() {
  const { id } = useParams()
  const experienciaId = Number(id)
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Se recarga al iniciar o cerrar sesión: una experiencia pausada solo la ve su dueño
  const { datos, error, cargando, recargar } = useCarga(() => obtenerExperiencia(experienciaId), [experienciaId, usuario?.id])

  // Si se llegó desde otra página del sitio, "Volver" regresa a ella (p. ej. al catálogo con sus filtros)
  const volver = () => (location.key !== 'default' ? navigate(-1) : navigate('/'))
  const noExiste = error instanceof ErrorApi && error.status === 404

  return (
    <section className="w-full max-w-6xl">
      <button
        type="button"
        onClick={volver}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-campo-600 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </button>

      {error && !cargando ? (
        <>
          <ErrorCarga
            error={error}
            titulo={noExiste ? 'Esta experiencia no está disponible' : 'No pudimos cargar la experiencia'}
            onReintentar={noExiste ? undefined : recargar}
          />
          {noExiste && (
            <p className="mt-4 text-center">
              <Link to="/" className="font-medium text-campo-600 hover:underline">
                Ver otras experiencias
              </Link>
            </p>
          )}
        </>
      ) : !datos ? (
        <p className="text-stone-500">Cargando…</p>
      ) : (
        <Detalle experiencia={datos} esDueno={usuario?.id === datos.emprendimiento.usuario_id} />
      )}
    </section>
  )
}

function Detalle({ experiencia: exp, esDueno }: { experiencia: ExperienciaDetalle; esDueno: boolean }) {
  const { Icono, nombre: nombreTipo } = tipoExperiencia(exp.tipo)
  const anfitrion = exp.emprendimiento
  const tieneUbicacion = exp.latitud !== null && exp.longitud !== null

  return (
    <article>
      {esDueno && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <p className="flex items-center gap-2 text-sm text-stone-600">
            {exp.estado === 'pausado' ? (
              <>
                <Pause className="size-4 text-amber-600" aria-hidden />
                <span>
                  <span className="font-medium text-stone-800">Experiencia pausada:</span> solo tú puedes ver esta página.
                </span>
              </>
            ) : (
              'Así ven los visitantes tu experiencia.'
            )}
          </p>
          <div className="flex gap-2">
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
              Galería
            </Link>
          </div>
        </div>
      )}

      <header className="mb-6">
        <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-campo-100 px-2.5 py-1 font-medium text-campo-700">
            <Icono className="size-4" aria-hidden />
            {nombreTipo}
          </span>
          <span className="inline-flex items-center gap-1 text-stone-500">
            <MapPin className="size-4" aria-hidden />
            {exp.localidad}
          </span>
        </p>
        <h1 className="text-3xl font-bold text-stone-800 sm:text-4xl">{exp.titulo}</h1>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          <GaleriaFotos fotos={exp.fotos} titulo={exp.titulo} IconoVacio={Icono} />

          <section>
            <h2 className="mb-3 text-xl font-semibold text-campo-700">Sobre la experiencia</h2>
            <p className="break-words whitespace-pre-line text-stone-700">{exp.descripcion}</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-campo-700">Ubicación</h2>
            {tieneUbicacion ? (
              <>
                <Suspense fallback={<div className="h-72 w-full animate-pulse rounded-xl bg-stone-200 sm:h-80" />}>
                  <MapaUbicacion latitud={exp.latitud!} longitud={exp.longitud!} etiqueta={exp.titulo} />
                </Suspense>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <a
                    href={`https://www.openstreetmap.org/directions?to=${exp.latitud}%2C${exp.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-campo-600 hover:underline"
                  >
                    <Navigation className="size-4" aria-hidden />
                    Cómo llegar
                  </a>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${exp.latitud}&mlon=${exp.longitud}#map=16/${exp.latitud}/${exp.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-campo-600 hover:underline"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Abrir en OpenStreetMap
                  </a>
                </div>
              </>
            ) : (
              <p className="flex items-start gap-2 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {exp.localidad}. El anfitrión no indicó el punto de encuentro exacto: consúltalo al contactarlo.
                </span>
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Reserva experiencia={exp} />
          <Anfitrion anfitrion={anfitrion} />
        </aside>
      </div>
    </article>
  )
}

function Reserva({ experiencia: exp }: { experiencia: ExperienciaDetalle }) {
  const { Icono, nombre: nombreTipo } = tipoExperiencia(exp.tipo)
  const { redes, telefono_contacto } = exp.emprendimiento
  const IconoWhatsapp = REDES_INFO.whatsapp.Icono
  const mensaje = `Hola, me interesa la experiencia "${exp.titulo}" que vi en Turismo Rural.`

  return (
    <div className="rounded-2xl bg-white p-5 shadow-lg">
      <p className="text-stone-800">
        <span className="text-3xl font-bold text-campo-700">{formatearPrecio(exp.precio_por_persona)}</span>
        {exp.precio_por_persona > 0 && <span className="text-stone-500"> / persona</span>}
      </p>
      <ul className="mt-4 space-y-2 text-sm text-stone-700">
        <li className="flex items-center gap-2">
          <Users className="size-4 shrink-0 text-stone-400" aria-hidden />
          Hasta {exp.capacidad_maxima} {exp.capacidad_maxima === 1 ? 'persona' : 'personas'} por salida
        </li>
        <li className="flex items-center gap-2">
          <Icono className="size-4 shrink-0 text-stone-400" aria-hidden />
          {nombreTipo}
        </li>
        <li className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0 text-stone-400" aria-hidden />
          {exp.localidad}
        </li>
      </ul>
      {redes.whatsapp ? (
        <a
          href={`${enlaceRed('whatsapp', redes.whatsapp)}?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-campo-600 py-3 font-medium text-white shadow transition hover:bg-campo-700"
        >
          <IconoWhatsapp className="size-5" aria-hidden />
          Consultar por WhatsApp
        </a>
      ) : (
        <a
          href={`tel:${telefono_contacto}`}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-campo-600 py-3 font-medium text-white shadow transition hover:bg-campo-700"
        >
          <Phone className="size-5" aria-hidden />
          Llamar al anfitrión
        </a>
      )}
      <p className="mt-2 text-center text-xs text-stone-500">Coordina la fecha y la reserva directamente con el anfitrión.</p>
    </div>
  )
}

function Anfitrion({ anfitrion }: { anfitrion: ExperienciaDetalle['emprendimiento'] }) {
  const foto = urlArchivo(anfitrion.foto_url)
  const redes = CAMPOS_REDES.filter((red) => anfitrion.redes[red])

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">Tu anfitrión</h2>
      <div className="flex items-center gap-3">
        {foto ? (
          <img src={foto} alt="" className="size-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-campo-100 text-campo-600">
            <Store className="size-6" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-semibold break-words text-stone-800">{anfitrion.nombre}</p>
          <p className="flex items-center gap-1 text-sm text-stone-500">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {anfitrion.localidad}
          </p>
        </div>
      </div>

      {anfitrion.descripcion && (
        <p className="mt-3 line-clamp-4 text-sm break-words whitespace-pre-line text-stone-600">{anfitrion.descripcion}</p>
      )}

      <p className="mt-3 flex items-center gap-2 text-sm text-stone-700">
        <Phone className="size-4 shrink-0 text-stone-400" aria-hidden />
        <a href={`tel:${anfitrion.telefono_contacto}`} className="hover:underline">
          {anfitrion.telefono_contacto}
        </a>
      </p>

      {redes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {redes.map((red) => {
            const { nombre, Icono } = REDES_INFO[red]
            return (
              <li key={red}>
                <a
                  href={enlaceRed(red, anfitrion.redes[red]!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-campo-50 px-3 py-1 text-sm font-medium text-campo-700 transition hover:bg-campo-100"
                >
                  <Icono className="size-4" aria-hidden />
                  {nombre}
                </a>
              </li>
            )
          })}
        </ul>
      )}

      <Link
        to={`/emprendimientos/${anfitrion.id}`}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-campo-600 hover:underline"
      >
        Ver página del emprendimiento
      </Link>
    </div>
  )
}
