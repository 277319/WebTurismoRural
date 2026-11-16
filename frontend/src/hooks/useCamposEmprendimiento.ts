import { useState } from 'react'
import {
  EMPRENDIMIENTO_VACIO,
  validarEmprendimiento,
  type CampoEmprendimiento,
  type DatosEmprendimiento,
  type ErroresEmprendimiento,
} from '../validacion'

/** Estado, validación y errores del servidor para los campos de un emprendimiento. */
export function useCamposEmprendimiento(inicial: DatosEmprendimiento = EMPRENDIMIENTO_VACIO) {
  const [valores, setValores] = useState(inicial)
  const [tocados, setTocados] = useState<Partial<Record<CampoEmprendimiento, boolean>>>({})
  const [erroresServidor, setErroresServidor] = useState<ErroresEmprendimiento>({})

  const erroresLocales = validarEmprendimiento(valores)
  const errores: ErroresEmprendimiento = {}
  for (const campo of Object.keys(valores) as CampoEmprendimiento[]) {
    const error = erroresServidor[campo] ?? (tocados[campo] ? erroresLocales[campo] : undefined)
    if (error) errores[campo] = error
  }

  return {
    valores,
    errores,
    valido: Object.keys(erroresLocales).length === 0,
    cambiar(campo: CampoEmprendimiento, valor: string) {
      setValores((v) => ({ ...v, [campo]: valor }))
      setErroresServidor((e) => ({ ...e, [campo]: undefined }))
    },
    tocar(campo: CampoEmprendimiento) {
      setTocados((t) => ({ ...t, [campo]: true }))
    },
    tocarTodos() {
      setTocados({ nombre: true, telefono_contacto: true, direccion: true, localidad: true })
    },
    /** Muestra un error del servidor en su campo. Devuelve false si el campo no es de emprendimiento. */
    errorDeServidor(campo: string, mensaje: string): boolean {
      if (!(campo in EMPRENDIMIENTO_VACIO)) return false
      setErroresServidor((e) => ({ ...e, [campo]: mensaje }))
      return true
    },
  }
}

export type CamposEmprendimiento = ReturnType<typeof useCamposEmprendimiento>
