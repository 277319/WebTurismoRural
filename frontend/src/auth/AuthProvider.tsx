import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { iniciarSesion as loginApi, obtenerUsuarioActual, type DatosLogin, type Usuario } from '../api/auth'
import { borrarToken, EVENTO_SESION_EXPIRADA, guardarToken, obtenerToken } from '../api/cliente'
import { AuthContext } from './contexto'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(() => obtenerToken() !== null)

  // Al cargar la app, si hay un token guardado, recupera el usuario con /auth/me
  useEffect(() => {
    if (!obtenerToken()) return
    obtenerUsuarioActual()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false))
  }, [])

  // Si cualquier petición recibe 401 con nuestro token, cerramos la sesión
  useEffect(() => {
    const alExpirar = () => setUsuario(null)
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar)
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar)
  }, [])

  const iniciarSesion = useCallback(async (datos: DatosLogin) => {
    const { access_token, usuario } = await loginApi(datos)
    guardarToken(access_token)
    setUsuario(usuario)
  }, [])

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setUsuario(null)
  }, [])

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion, actualizarUsuario: setUsuario }),
    [usuario, cargando, iniciarSesion, cerrarSesion],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
