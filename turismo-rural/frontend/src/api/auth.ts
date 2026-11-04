import type { DatosEmprendimiento } from '../validacion'
import { apiFetch, errorDesdeRespuesta } from './cliente'

export type Rol = 'visitante' | 'anfitrion' | 'admin'

export const NOMBRE_ROL: Record<Rol, string> = {
  visitante: 'Visitante',
  anfitrion: 'Anfitrión',
  admin: 'Administrador',
}

export type Usuario = {
  id: number
  nombre: string | null
  correo: string | null
  telefono: string | null
  rol: Rol
  fecha_creacion: string
}

export type DatosRegistro = {
  correo?: string
  telefono?: string
  contrasena: string
  rol: 'visitante' | 'anfitrion'
  emprendimiento?: DatosEmprendimiento
}

export type DatosLogin = {
  identificador: string
  contrasena: string
}

export type RespuestaLogin = {
  access_token: string
  token_type: 'bearer'
  usuario: Usuario
}

export async function registrar(datos: DatosRegistro): Promise<Usuario> {
  const res = await apiFetch('/auth/registro', { method: 'POST', body: JSON.stringify(datos) })
  if (!res.ok) throw await errorDesdeRespuesta(res)
  return res.json()
}

export async function iniciarSesion(datos: DatosLogin): Promise<RespuestaLogin> {
  const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(datos) })
  if (!res.ok) throw await errorDesdeRespuesta(res)
  return res.json()
}

/** Devuelve el usuario dueño del token guardado, o null si no hay sesión válida. */
export async function obtenerUsuarioActual(): Promise<Usuario | null> {
  const res = await apiFetch('/auth/me')
  return res.ok ? res.json() : null
}
