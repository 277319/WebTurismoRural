import { Eye, Pencil } from 'lucide-react'

export type VistaMovil = 'editar' | 'previa'

/** En pantallas pequeñas, alterna entre el formulario y la vista previa (en lg se ven ambos). */
export default function PestanasVistaPrevia({ vista, onCambiar }: { vista: VistaMovil; onCambiar: (v: VistaMovil) => void }) {
  return (
    <div className="grid grid-cols-2 rounded-lg bg-stone-200/60 p-1 text-sm font-medium lg:hidden" role="tablist">
      {(['editar', 'previa'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={vista === v}
          onClick={() => onCambiar(v)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition ${
            vista === v ? 'bg-white text-campo-700 shadow' : 'text-stone-600'
          }`}
        >
          {v === 'editar' ? <Pencil className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          {v === 'editar' ? 'Editar' : 'Vista previa'}
        </button>
      ))}
    </div>
  )
}
