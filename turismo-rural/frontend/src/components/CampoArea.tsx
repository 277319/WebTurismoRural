type CampoAreaProps = {
  id: string
  label: string
  value: string
  maxLength: number
  error?: string
  placeholder?: string
  filas?: number
  onChange: (valor: string) => void
  onBlur: () => void
}

/** Textarea con contador de caracteres. */
export default function CampoArea({ id, label, value, maxLength, error, placeholder, filas = 4, onChange, onBlur }: CampoAreaProps) {
  const excedido = value.length > maxLength

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-base font-semibold text-stone-800">
          {label}
        </label>
        <span className={`text-sm ${excedido ? 'font-medium text-red-600' : 'text-stone-500'}`} aria-live="polite">
          {value.length}/{maxLength}
        </span>
      </div>
      <textarea
        id={id}
        name={id}
        rows={filas}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full resize-y rounded-lg border-2 bg-white px-3 py-3 text-base outline-none transition focus:ring-2 ${
          error
            ? 'border-red-600 focus:border-red-600 focus:ring-red-200'
            : 'border-stone-500 focus:border-campo-500 focus:ring-campo-100'
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-base font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
