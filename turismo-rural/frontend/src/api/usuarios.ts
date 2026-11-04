import type { Usuario } from './auth'
import { apiFetch, errorDesdeRespuesta } from './cliente'

export type DatosMiCuenta = {
  nombre: string | null
  correo: string | null
  telefono: string | null
  /** Obligatoria solo si cambia el correo o el teléfono */
  contrasena_actual?: string
}

export async function actualizarMiCuenta(datos: DatosMiCuenta): Promise<Usuario> {
  const res = await apiFetch('/usuarios/me', { method: 'PUT', body: JSON.stringify(datos) })
  if (!res.ok) throw await errorDesdeRespuesta(res)
  return res.json()
}
