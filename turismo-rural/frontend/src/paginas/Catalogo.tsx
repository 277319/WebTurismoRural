import { ChevronLeft, ChevronRight, Compass } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { catalogoExperiencias } from '../api/experiencias'
import ErrorCarga from '../components/ErrorCarga'
import TarjetaExperiencia from '../components/TarjetaExperiencia'
import { useCarga } from '../hooks/useCarga'

const POR_PAGINA = 12

export default function Catalogo() {
  const [params, setParams] = useSearchParams()
  const pagina = Math.max(1, Number.parseInt(params.get('pagina') ?? '1', 10) || 1)
  const { datos, error, cargando, recargar } = useCarga(() => catalogoExperiencias(pagina, POR_PAGINA), [pagina])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pagina])

  const irA = (n: number) => setParams(n === 1 ? {} : { pagina: String(n) })

  return (
    <section className="w-full">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-campo-700 sm:text-4xl">Experiencias rurales</h1>
        <p className="mt-2 text-stone-600">Descubre actividades únicas junto a emprendedores locales.</p>
      </div>

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar el catálogo" onReintentar={recargar} />
      ) : cargando && !datos ? (
        <Esqueleto />
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
          <Link to="/" className="mt-3 inline-block font-medium text-campo-600 hover:underline">
            Ir a la primera página
          </Link>
        </div>
      ) : (
        datos && (
          <>
            <p className="mb-4 text-sm text-stone-500" aria-live="polite">
              {datos.total} {datos.total === 1 ? 'experiencia' : 'experiencias'}
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
