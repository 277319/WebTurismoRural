import type { TipoExperiencia } from '../api/experiencias'
import { TIPOS_EXPERIENCIA } from '../tiposExperiencia'

type Props = {
  valor: TipoExperiencia | null
  error?: string
  onChange: (tipo: TipoExperiencia) => void
}

/** Grupo de radios con ícono: se puede usar con el ratón o con el teclado (flechas). */
export default function SelectorTipo({ valor, error, onChange }: Props) {
  return (
    <fieldset aria-describedby={error ? 'tipo-error' : undefined}>
      <legend className="mb-2 text-sm font-medium text-stone-700">Tipo de experiencia</legend>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {TIPOS_EXPERIENCIA.map(({ id, nombre, Icono }) => {
          const activo = valor === id
          return (
            <label
              key={id}
              className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center text-xs font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-campo-500 sm:text-sm ${
                activo
                  ? 'border-campo-500 bg-campo-50 text-campo-700'
                  : error
                    ? 'border-red-200 text-stone-600 hover:border-campo-500'
                    : 'border-stone-200 text-stone-600 hover:border-campo-500'
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={id}
                checked={activo}
                onChange={() => onChange(id)}
                className="sr-only"
              />
              <Icono className={`size-7 ${activo ? 'text-campo-600' : 'text-stone-500'}`} strokeWidth={1.75} aria-hidden />
              {nombre}
            </label>
          )
        })}
      </div>
      {error && (
        <p id="tipo-error" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  )
}
