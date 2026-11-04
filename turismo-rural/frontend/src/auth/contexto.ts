import { createContext, useContext } from 'react'
import type { DatosLogin, Usuario } from '../api/auth'

export type EstadoAuth = {
  usuario: Usuario | null
  /** true mientras se comprueba el token guardado al cargar la app */
  cargando: boolean
  iniciarSesion: (datos: DatosLogin) => Promise<void>
  cerrarSesion: () => void
  /** Reemplaza los datos del usuario en sesión (p. ej. tras editar "Mi cuenta") */
  actualizarUsuario: (usuario: Usuario) => void
}

export const AuthContext = createContext<EstadoAuth | null>(null)

export function useAuth(): EstadoAuth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
