import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/contexto'
import LoginForm from '../components/LoginForm'
import RegistroForm from '../components/RegistroForm'

export function Ingresar() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Tras iniciar sesión, vuelve a la página protegida que se intentó abrir (o al inicio del rol)
  if (usuario) {
    const desde = (location.state as { desde?: string } | null)?.desde
    const inicio = usuario.rol === 'anfitrion' ? '/mis-experiencias' : '/'
    return <Navigate to={desde ?? inicio} replace />
  }
  return <LoginForm onIrARegistro={() => navigate('/registro')} />
}

export function Registro() {
  const { usuario } = useAuth()
  const navigate = useNavigate()

  if (usuario) return <Navigate to="/" replace />
  return <RegistroForm onIrALogin={() => navigate('/ingresar')} />
}
