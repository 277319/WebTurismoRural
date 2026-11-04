import { ChevronLeft, ChevronRight, Compass, SearchX } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { catalogoExperiencias, localidadesCatalogo, type TipoExperiencia } from '../api/experiencias'
import ErrorCarga from '../components/ErrorCarga'
import FiltrosCatalogo, { type CambiosFiltros } from '../components/FiltrosCatalogo'
import TarjetaExperiencia from '../components/TarjetaExperiencia'
import { useCarga } from '../hooks/useCarga'
import { TIPOS_EXPERIENCIA } from '../tiposExperiencia'

const POR_PAGINA = 12
const TIPOS_VALIDOS = new Set<string>(TIPOS_EXPERIENCIA.map((t) => t.id))

/** Precio de la URL; se ignora si no es un número válido (p. ej. un enlace editado a mano) */
function leerPrecio(valor: string | null): number | undefined {
  return valor && /^\d+(\.\d{1,2})?$/.test(valor) ? Number(valor) : undefined
}

export default function Catalogo() {
  // Página y filtros viven en la URL: se pueden compartir y funcionan con atrás/adelante
  const [params, setParams] = useSearchParams()
  const pagina = Math.max(1, Number.parseInt(params.get('pagina') ?? '1', 10) || 1)
  const localidad = params.get('localidad') ?? ''
  const tipos = params.getAll('tipo').filter((t): t is TipoExperiencia => TIPOS_VALIDOS.has(t))
  const precioMin = params.get('precio_min') ?? ''
  const precioMax = params.get('precio_max') ?? ''
  const hayFiltros = localidad.trim() !== '' || tipos.length > 0 || leerPrecio(precioMin) !== undefined || leerPrecio(precioMax) !== undefined

  const filtros = { localidad, tipos, precioMin: leerPrecio(precioMin), precioMax: leerPrecio(precioMax) }
  const claveFiltros = JSON.stringify(filtros)
  const { datos, error, cargando, recargar } = useCarga(
    () => catalogoExperiencias(pagina, POR_PAGINA, filtros),
    [pagina, claveFiltros],
  )
  // Sugerencias para el filtro de localidad; si fallan, el campo funciona igual sin ellas
  const { datos: localidades } = useCarga(localidadesCatalogo, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pagina])

  const irA = (n: number) =>
    setParams((previos) => {
      const siguientes = new URLSearchParams(previos)
      if (n === 1) siguientes.delete('pagina')
      else siguientes.set('pagina', String(n))
      return siguientes
    })

  /** Cualquier cambio de filtro vuelve a la primera página */
  function cambiarFiltros(cambios: CambiosFiltros, reemplazar = false) {
    setParams(
      (previos) => {
        const siguientes = new URLSearchParams(previos)
        for (const [clave, valor] of Object.entries(cambios)) {
          siguientes.delete(clave)
          for (const v of [valor ?? []].flat()) if (v) siguientes.append(clave, v)
        }
        siguientes.delete('pagina')
        return siguientes
      },
      { replace: reemplazar },
    )
  }

  const limpiarFiltros = () => cambiarFiltros({ localidad: null, tipo: null, precio_min: null, precio_max: null })

  return (
    <section className="w-full">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-campo-700 sm:text-4xl">Experiencias rurales</h1>
        <p className="mt-2 text-stone-600">Descubre actividades únicas junto a emprendedores locales.</p>
      </div>

      <FiltrosCatalogo
        localidad={localidad}
        tipos={tipos}
        precioMin={precioMin}
        precioMax={precioMax}
        localidades={localidades ?? []}
        onCambiar={cambiarFiltros}
      />

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar el catálogo" onReintentar={recargar} />
      ) : cargando && !datos ? (
        <Esqueleto />
      ) : datos && datos.total === 0 && hayFiltros ? (
        <div className={`flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center ${cargando ? 'opacity-60' : ''}`}>
          <SearchX className="mb-3 size-10 text-stone-400" aria-hidden />
          <p className="font-medium text-stone-700" aria-live="polite">
            No encontramos experiencias con estos filtros
          </p>
          <p className="mt-1 text-sm text-stone-500">Prueba con otra localidad, un rango de precio más amplio u otros tipos.</p>
          <button
            type="button"
            onClick={limpiarFiltros}
            className="mt-4 rounded-lg bg-campo-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-campo-700"
          >
            Limpiar filtros
          </button>
        </div>
      ) : datos && datos.total === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <Compass className="mb-3 size-10 text-stone-400" aria-hidden />
          <p className="font-medium text-stone-700">Aún no hay experiencias publicadas</p>
          <p className="mt-1 text-sm text-stone-500">Vuelve pronto: los anfitriones están preparando nuevas actividades.</p>
        </div>
      ) : datos && datos.items.length === 0 ? (
        // La página pedida no existe (p. ej. ?pagina=99)
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="font-medium text-stone-700">Esta página no tiene experiencias.</p>
          <button type="button" onClick={() => irA(1)} className="mt-3 inline-block font-medium text-campo-600 hover:underline">
            Ir a la primera página
          </button>
        </div>
      ) : (
        datos && (
          <>
            <p className="mb-4 text-sm text-stone-500" aria-live="polite">
              {datos.total} {datos.total === 1 ? 'experiencia' : 'experiencias'}
              {hayFiltros && (datos.total === 1 ? ' encontrada' : ' encontradas')}
            </p>
            <ul className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${cargando ? 'opacity-60' : ''}`} aria-busy={cargando}>
              {datos.items.map((exp) => (
                <li key={exp.id} className="flex">
                  <TarjetaExperiencia experiencia={exp} />
                </li>
              ))}
            </ul>

            {datos.paginas > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-4" aria-label="Paginación">
                <button
                  type="button"
                  onClick={() => irA(pagina - 1)}
                  disabled={pagina <= 1 || cargando}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Anterior
                </button>
                <span className="text-sm text-stone-600">
                  Página {datos.pagina} de {datos.paginas}
                </span>
                <button
                  type="button"
                  onClick={() => irA(pagina + 1)}
                  disabled={pagina >= datos.paginas || cargando}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </nav>
            )}
          </>
        )
      )}
    </section>
  )
}

function Esqueleto() {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Cargando experiencias" aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="aspect-[4/3] bg-stone-200" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 rounded bg-stone-200" />
            <div className="h-3 w-1/2 rounded bg-stone-200" />
            <div className="h-5 w-1/3 rounded bg-stone-200" />
          </div>
        </li>
      ))}
    </ul>
  )
}
