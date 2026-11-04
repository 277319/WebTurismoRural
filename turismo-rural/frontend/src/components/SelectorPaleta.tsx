import { Check, Paintbrush } from 'lucide-react'
import { useState } from 'react'
import { derivarSecundario, PALETAS, paletaDe } from '../fichaEmprendimiento'

type Props = {
  primario: string
  secundario: string
  onCambiar: (primario: string, secundario: string) => void
}

const COLOR_LIBRE_INICIAL = '#7a4b8c'

const claseOpcion =
  'relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-stone-200 p-3 text-sm font-medium text-stone-700 transition hover:border-stone-300 has-checked:border-campo-600 has-checked:bg-campo-50 has-focus-visible:ring-2 has-focus-visible:ring-campo-500 has-focus-visible:ring-offset-2'

function Muestra({ primario, secundario }: { primario: string; secundario: string }) {
  return (
    <span className="flex" aria-hidden>
      <span className="size-7 rounded-full border-2 border-white shadow" style={{ background: primario }} />
      <span className="-ml-2 size-7 rounded-full border-2 border-white shadow" style={{ background: secundario }} />
    </span>
  )
}

function MarcaElegida() {
  return (
    <span className="absolute top-1.5 right-1.5 hidden size-5 items-center justify-center rounded-full bg-campo-600 text-white group-has-checked:flex">
      <Check className="size-3" aria-hidden />
    </span>
  )
}

/** 4 paletas predefinidas y una opción de color libre (el secundario se deriva automáticamente). */
export default function SelectorPaleta({ primario, secundario, onCambiar }: Props) {
  const seleccion = paletaDe(primario, secundario)
  const [colorLibre, setColorLibre] = useState(seleccion === 'libre' ? primario : COLOR_LIBRE_INICIAL)

  function elegirLibre(color: string) {
    setColorLibre(color)
    onCambiar(color, derivarSecundario(color))
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Paleta de colores" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PALETAS.map((p) => (
          <label key={p.id} className={`group ${claseOpcion}`}>
            <input
              type="radio"
              name="paleta"
              value={p.id}
              checked={seleccion === p.id}
              onChange={() => onCambiar(p.primario, p.secundario)}
              className="sr-only"
            />
            <MarcaElegida />
            <Muestra primario={p.primario} secundario={p.secundario} />
            {p.nombre}
          </label>
        ))}
        <label className={`group ${claseOpcion}`}>
          <input
            type="radio"
            name="paleta"
            value="libre"
            checked={seleccion === 'libre'}
            onChange={() => elegirLibre(colorLibre)}
            className="sr-only"
          />
          <MarcaElegida />
          {seleccion === 'libre' ? (
            <Muestra primario={primario} secundario={secundario} />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full border-2 border-dashed border-stone-300 text-stone-400" aria-hidden>
              <Paintbrush className="size-3.5" />
            </span>
          )}
          Color libre
        </label>
      </div>

      {seleccion === 'libre' && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-stone-50 p-3">
          <input
            id="color-libre"
            type="color"
            value={colorLibre}
            onChange={(e) => elegirLibre(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-stone-300 bg-white p-0.5"
          />
          <div className="min-w-0 text-sm">
            <label htmlFor="color-libre" className="font-medium text-stone-700">
              Tu color <span className="font-mono text-stone-500 uppercase">{colorLibre}</span>
            </label>
            <p className="text-xs text-stone-500">El color secundario se genera a partir de este.</p>
          </div>
        </div>
      )}
    </div>
  )
}
