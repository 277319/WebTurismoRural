import { ChevronLeft, ChevronRight, Expand, X, type LucideIcon } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { urlArchivo } from '../api/cliente'
import type { FotoExperiencia } from '../api/experiencias'

type Props = {
  fotos: FotoExperiencia[]
  /** Para el texto alternativo: "Foto 2 de 5 de <titulo>" */
  titulo: string
  /** Ícono que se muestra si no hay fotos */
  IconoVacio: LucideIcon
}

/** Visor de fotos con miniaturas; se navega con las flechas del teclado y se puede ver a pantalla completa. */
export default function GaleriaFotos({ fotos, titulo, IconoVacio }: Props) {
  const [indice, setIndice] = useState(0)
  const dialogo = useRef<HTMLDialogElement>(null)

  if (fotos.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-gradient-to-br from-campo-100 to-campo-50 text-campo-500">
        <IconoVacio className="size-20" strokeWidth={1.25} aria-hidden />
      </div>
    )
  }

  const actual = Math.min(indice, fotos.length - 1)
  const varias = fotos.length > 1
  const ir = (paso: number) => setIndice((actual + paso + fotos.length) % fotos.length)
  const alt = (i: number) => `Foto ${i + 1} de ${fotos.length} de ${titulo}`

  function conFlechas(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') ir(-1)
    else if (e.key === 'ArrowRight') ir(1)
    else return
    e.preventDefault()
  }

  const flechas = (claseBoton: string) =>
    varias && (
      <>
        <button type="button" onClick={() => ir(-1)} aria-label="Foto anterior" className={`left-3 ${claseBoton}`}>
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={() => ir(1)} aria-label="Foto siguiente" className={`right-3 ${claseBoton}`}>
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </>
    )

  return (
    <div>
      <div
        role="region"
        aria-roledescription="galería"
        aria-label={`Fotos de ${titulo}`}
        tabIndex={varias ? 0 : undefined}
        onKeyDown={conFlechas}
        className="group relative aspect-[16/10] overflow-hidden rounded-2xl bg-stone-100 focus-visible:ring-2 focus-visible:ring-campo-500 focus-visible:outline-none"
      >
        <img src={urlArchivo(fotos[actual].url) ?? undefined} alt={alt(actual)} className="size-full object-cover" />
        {flechas(
          'absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow transition hover:bg-white',
        )}
        <button
          type="button"
          onClick={() => dialogo.current?.showModal()}
          aria-label="Ver a pantalla completa"
          className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow transition hover:bg-white"
        >
          <Expand className="size-4" aria-hidden />
        </button>
        {varias && (
          <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white" aria-hidden>
            {actual + 1} / {fotos.length}
          </span>
        )}
      </div>

      {varias && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Miniaturas">
          {fotos.map((foto, i) => (
            <li key={foto.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === actual}
                className={`block overflow-hidden rounded-lg transition focus-visible:ring-2 focus-visible:ring-campo-500 focus-visible:outline-none ${
                  i === actual ? 'ring-2 ring-campo-600 ring-offset-2' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <img src={urlArchivo(foto.url) ?? undefined} alt="" loading="lazy" className="h-14 w-20 object-cover sm:h-16 sm:w-24" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* <dialog> nativo: cierra con Escape y mantiene el foco dentro mientras está abierto */}
      <dialog
        ref={dialogo}
        aria-label={`Fotos de ${titulo}`}
        onKeyDown={conFlechas}
        className="m-0 h-dvh max-h-none w-dvw max-w-none bg-black/90 p-0 backdrop:bg-black/80"
      >
        {/* Un clic fuera de la foto la cierra */}
        <div className="relative flex size-full items-center justify-center p-4 sm:p-12" onClick={(e) => e.target === e.currentTarget && dialogo.current?.close()}>
          <img src={urlArchivo(fotos[actual].url) ?? undefined} alt={alt(actual)} className="max-h-full max-w-full object-contain" />
          {flechas(
            'absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30',
          )}
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            aria-label="Cerrar"
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
          >
            <X className="size-5" aria-hidden />
          </button>
          {varias && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">
              {actual + 1} / {fotos.length}
            </span>
          )}
        </div>
      </dialog>
    </div>
  )
}
