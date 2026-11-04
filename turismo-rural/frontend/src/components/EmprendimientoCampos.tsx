import type { CamposEmprendimiento } from '../hooks/useCamposEmprendimiento'
import type { CampoEmprendimiento } from '../validacion'
import CampoTexto from './CampoTexto'

const CONFIG: Record<CampoEmprendimiento, { label: string; type: string; placeholder: string; autoComplete?: string }> = {
  nombre: { label: 'Nombre del emprendimiento', type: 'text', placeholder: 'Cabañas El Roble' },
  telefono_contacto: { label: 'Teléfono de contacto', type: 'tel', placeholder: '+56 9 1234 5678', autoComplete: 'tel' },
  direccion: { label: 'Dirección', type: 'text', placeholder: 'Camino Rural 123', autoComplete: 'street-address' },
  localidad: { label: 'Localidad', type: 'text', placeholder: 'Pucón', autoComplete: 'address-level2' },
}

/** Los cuatro campos de un emprendimiento. `idPrefijo` evita ids repetidos si hay varios formularios. */
export default function EmprendimientoCampos({ campos, idPrefijo }: { campos: CamposEmprendimiento; idPrefijo: string }) {
  return (
    <div className="space-y-4">
      {(Object.keys(CONFIG) as CampoEmprendimiento[]).map((campo) => (
        <CampoTexto
          key={campo}
          id={`${idPrefijo}-${campo}`}
          {...CONFIG[campo]}
          value={campos.valores[campo]}
          error={campos.errores[campo]}
          onChange={(v) => campos.cambiar(campo, v)}
          onBlur={() => campos.tocar(campo)}
        />
      ))}
    </div>
  )
}
