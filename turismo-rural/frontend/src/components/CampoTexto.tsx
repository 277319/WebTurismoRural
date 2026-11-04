import type { InputHTMLAttributes, ReactNode } from 'react'

type CampoTextoProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onBlur' | 'value'> & {
  id: string
  label: string
  type: string
  value: string
  error?: string
  /** Texto de ayuda bajo el campo (se oculta si hay error) */
  ayuda?: ReactNode
  /** Contenido fijo a la izquierda del input, p. ej. "$" o "@" */
  prefijo?: ReactNode
  onChange: (valor: string) => void
  onBlur: () => void
}

export default function CampoTexto({ id, label, error, ayuda, prefijo, onChange, ...input }: CampoTextoProps) {
  const descripcion = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      <div className="relative">
        {prefijo && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-400">{prefijo}</span>
        )}
        <input
          id={id}
          name={id}
          {...input}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={descripcion}
          className={`w-full rounded-lg border py-2 pr-3 outline-none transition focus:ring-2 ${prefijo ? 'pl-8' : 'pl-3'} ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
              : 'border-stone-300 focus:border-campo-500 focus:ring-campo-100'
          }`}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-ayuda`} className="mt-1 text-xs text-stone-500">
            {ayuda}
          </p>
        )
      )}
    </div>
  )
}
