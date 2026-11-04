import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { NOMBRE_ROL } from '../api/auth'
import { useAuth } from '../auth/contexto'

const claseEnlace = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-campo-100 text-campo-700' : 'text-stone-600 hover:bg-stone-100'
  }`

export default function Layout() {
  const { usuario, cerrarSesion } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-campo-50 text-stone-800">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
          <Link to="/" className="text-xl font-bold text-campo-700">
            Turismo Rural
          </Link>

          <nav className="flex flex-wrap gap-1" aria-label="Principal">
            <NavLink to="/" end className={claseEnlace}>
              Catálogo
            </NavLink>
            {usuario?.rol === 'anfitrion' && (
              <>
                <NavLink to="/mis-emprendimientos" className={claseEnlace}>
                  Mis emprendimientos
                </NavLink>
                <NavLink to="/mis-experiencias" className={claseEnlace}>
                  Mis experiencias
                </NavLink>
              </>
            )}
            {usuario && (
              <NavLink to="/mi-cuenta" className={claseEnlace}>
                Mi cuenta
              </NavLink>
            )}
          </nav>

          {usuario ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-medium">{usuario.nombre ?? usuario.correo ?? usuario.telefono}</p>
                <p className="text-xs text-stone-500">{NOMBRE_ROL[usuario.rol]}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  cerrarSesion()
                  navigate('/')
                }}
                className="shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                to="/ingresar"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/registro"
                className="rounded-lg bg-campo-600 px-3 py-2 text-sm font-medium text-white shadow transition hover:bg-campo-700"
              >
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col items-center px-4 py-10">
        <Outlet />
      </main>
    </div>
  )
}
