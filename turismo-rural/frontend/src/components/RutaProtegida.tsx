import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Rol } from '../api/auth'
import { useAuth } from '../auth/contexto'

/** Exige sesión iniciada (y opcionalmente un rol). Sin sesión, redirige a /ingresar y luego vuelve. */
export default function RutaProtegida({ rol, children }: { rol?: Rol; children: ReactNode }) {
  const { usuario } = useAuth()
  const location = useLocation()

  if (!usuario) return <Navigate to="/ingresar" replace state={{ desde: location.pathname }} />
  if (rol && usuario.rol !== rol) return <Navigate to="/" replace />
  return children
}
