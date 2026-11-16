import {
  CalendarCheck,
  CalendarDays,
  CirclePlus,
  ClipboardList,
  Compass,
  Eye,
  Images,
  LoaderCircle,
  LogIn,
  LogOut,
  Menu,
  Palette,
  Pencil,
  Store,
  Trees,
  UserPlus,
  UserRound,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import { NOMBRE_ROL, type Usuario } from '../api/auth'
import { useAuth } from '../auth/contexto'

type Enlace = {
  a: string
  texto: string
  /** Qué se hace en esa página, en pocas palabras */
  ayuda: string
  Icono: LucideIcon
  /** Solo activo en esa ruta exacta (no en sus subrutas) */
  exacto?: boolean
}

type Grupo = { titulo: string; enlaces: Enlace[] }

// Páginas de una experiencia o emprendimiento propio: el menú muestra también sus demás páginas
const SECCIONES_EXPERIENCIA = ['editar', 'galeria', 'disponibilidad', 'reservas']
const SECCIONES_EMPRENDIMIENTO = ['editar', 'personalizar']

function gruposDelMenu(usuario: Usuario | null, experienciaId: string | null, emprendimientoId: string | null): Grupo[] {
  const grupos: Grupo[] = [
    {
      titulo: 'Explorar',
      enlaces: [{ a: '/', texto: 'Experiencias', ayuda: 'Busca y reserva actividades', Icono: Compass, exacto: true }],
    },
  ]

  if (!usuario) {
    grupos.push({
      titulo: 'Tu cuenta',
      enlaces: [
        { a: '/ingresar', texto: 'Iniciar sesión', ayuda: 'Si ya tienes una cuenta', Icono: LogIn },
        { a: '/registro', texto: 'Crear cuenta', ayuda: 'Gratis. Para reservar o publicar', Icono: UserPlus },
      ],
    })
    return grupos
  }

  grupos.push({
    titulo: 'Tu cuenta',
    enlaces: [
      { a: '/mis-reservas', texto: 'Mis reservas', ayuda: 'Revisa, paga o cancela tus reservas', Icono: CalendarCheck },
      { a: '/mi-cuenta', texto: 'Mi cuenta', ayuda: 'Tu nombre, correo y teléfono', Icono: UserRound },
    ],
  })

  if (usuario.rol === 'anfitrion') {
    grupos.push({
      titulo: 'Tu negocio',
      enlaces: [
        { a: '/mis-emprendimientos', texto: 'Mis emprendimientos', ayuda: 'Tus negocios y su página', Icono: Store },
        { a: '/mis-experiencias', texto: 'Mis experiencias', ayuda: 'Fotos, fechas y reservas de cada una', Icono: ClipboardList },
        { a: '/experiencias/nueva', texto: 'Publicar experiencia', ayuda: 'Agrega una actividad nueva', Icono: CirclePlus },
      ],
    })
    if (experienciaId) {
      const base = `/experiencias/${experienciaId}`
      grupos.push({
        titulo: 'Esta experiencia',
        enlaces: [
          { a: `${base}/reservas`, texto: 'Reservas', ayuda: 'Confirma o rechaza a los visitantes', Icono: ClipboardList },
          { a: `${base}/disponibilidad`, texto: 'Fechas y cupos', ayuda: 'Qué días la ofreces', Icono: CalendarDays },
          { a: `${base}/galeria`, texto: 'Fotos', ayuda: 'Sube y ordena las fotos', Icono: Images },
          { a: `${base}/editar`, texto: 'Editar datos', ayuda: 'Título, precio, lugar…', Icono: Pencil },
          { a: base, texto: 'Ver como visitante', ayuda: 'Así la ven los demás', Icono: Eye, exacto: true },
        ],
      })
    }
    if (emprendimientoId) {
      const base = `/emprendimientos/${emprendimientoId}`
      grupos.push({
        titulo: 'Este emprendimiento',
        enlaces: [
          { a: `${base}/editar`, texto: 'Editar datos', ayuda: 'Nombre, contacto y fotos', Icono: Pencil },
          { a: `${base}/personalizar`, texto: 'Personalizar página', ayuda: 'Colores, historia y más', Icono: Palette },
          { a: base, texto: 'Ver página', ayuda: 'Así la ven los visitantes', Icono: Eye, exacto: true },
        ],
      })
    }
  }
  return grupos
}

const ESCRITORIO = '(min-width: 1024px)'

/** true en pantallas anchas, donde el menú está siempre a la vista */
function useEsEscritorio() {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia(ESCRITORIO)
      consulta.addEventListener('change', avisar)
      return () => consulta.removeEventListener('change', avisar)
    },
    () => window.matchMedia(ESCRITORIO).matches,
  )
}

function useEnLinea() {
  return useSyncExternalStore(
    (avisar) => {
      window.addEventListener('online', avisar)
      window.addEventListener('offline', avisar)
      return () => {
        window.removeEventListener('online', avisar)
        window.removeEventListener('offline', avisar)
      }
    },
    () => navigator.onLine,
  )
}

export default function Layout() {
  const { usuario } = useAuth()
  const location = useLocation()
  const esEscritorio = useEsEscritorio()
  const enLinea = useEnLinea()
  // En pantallas chicas el menú es un panel que se abre desde la derecha. Se guarda la página donde se
  // abrió: al elegir un enlace cambia la página y el panel queda cerrado
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null)
  const abierto = abiertoEn === location.pathname
  const setAbierto = (valor: boolean) => setAbiertoEn(valor ? location.pathname : null)
  const botonMenu = useRef<HTMLButtonElement>(null)
  const botonCerrar = useRef<HTMLButtonElement>(null)

  const matchExperiencia = useMatch('/experiencias/:id/:seccion')
  const matchEmprendimiento = useMatch('/emprendimientos/:id/:seccion')
  const experienciaId =
    matchExperiencia && SECCIONES_EXPERIENCIA.includes(matchExperiencia.params.seccion!) ? matchExperiencia.params.id! : null
  const emprendimientoId =
    matchEmprendimiento && SECCIONES_EMPRENDIMIENTO.includes(matchEmprendimiento.params.seccion!)
      ? matchEmprendimiento.params.id!
      : null
  const grupos = gruposDelMenu(usuario, experienciaId, emprendimientoId)

  useEffect(() => {
    if (!abierto || esEscritorio) return
    botonCerrar.current?.focus()
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbiertoEn(null)
        botonMenu.current?.focus()
      }
    }
    document.addEventListener('keydown', cerrarConEscape)
    // Mientras está abierto, la página de fondo no se desplaza
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', cerrarConEscape)
      document.body.style.overflow = ''
    }
  }, [abierto, esEscritorio])

  const panelVisible = esEscritorio || abierto

  return (
    <div className="min-h-screen bg-campo-50 text-stone-800">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-campo-700 px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>

      {/* Pantallas chicas: barra fija con el botón del menú, siempre a la vista */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b-2 border-stone-200 bg-white px-4 py-2 lg:hidden">
        <Marca />
        <button
          ref={botonMenu}
          type="button"
          onClick={() => setAbierto(true)}
          aria-expanded={abierto}
          aria-controls="menu-lateral"
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-campo-700 px-4 text-lg font-semibold text-white shadow transition hover:bg-campo-600"
        >
          <Menu className="size-6" aria-hidden />
          Menú
        </button>
      </header>

      <div className="lg:flex">
        <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-10">
          {!enLinea && <AvisoSinConexion />}
          <div className="mx-auto flex max-w-6xl flex-col items-center">
            <Suspense fallback={<CargandoPagina />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        {abierto && !esEscritorio && (
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setAbierto(false)} aria-hidden />
        )}

        <aside
          id="menu-lateral"
          aria-label="Menú del sitio"
          // Cerrado en pantallas chicas: fuera de la vista y fuera del recorrido con teclado
          inert={!panelVisible}
          className={`fixed inset-y-0 right-0 z-50 flex w-80 max-w-[88vw] flex-col border-l-2 border-stone-200 bg-white shadow-2xl transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-72 lg:max-w-none lg:translate-x-0 lg:shadow-none ${
            panelVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b-2 border-stone-200 px-4 py-3">
            <Marca />
            {!esEscritorio && (
              <button
                ref={botonCerrar}
                type="button"
                onClick={() => {
                  setAbierto(false)
                  botonMenu.current?.focus()
                }}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-stone-500 px-3 text-base font-semibold text-stone-800 transition hover:bg-stone-100"
              >
                <X className="size-5" aria-hidden />
                Cerrar
              </button>
            )}
          </div>

          <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-4">
            {grupos.map((grupo) => (
              <section key={grupo.titulo} className="mb-5 last:mb-0">
                <h2 className="mb-1.5 px-3 text-sm font-bold tracking-wide text-stone-600 uppercase">{grupo.titulo}</h2>
                <ul className="space-y-1">
                  {grupo.enlaces.map((enlace) => (
                    <li key={enlace.a}>
                      <EnlaceMenu enlace={enlace} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>

          {usuario && <Sesion usuario={usuario} />}
        </aside>
      </div>
    </div>
  )
}

function Marca() {
  return (
    <Link to="/" className="flex min-h-12 items-center gap-2 rounded-lg text-xl font-bold text-campo-700">
      <Trees className="size-7" aria-hidden />
      Turismo Rural
    </Link>
  )
}

function EnlaceMenu({ enlace: { a, texto, ayuda, Icono, exacto } }: { enlace: Enlace }) {
  return (
    <NavLink
      to={a}
      end={exacto}
      className={({ isActive }) =>
        `flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 transition ${
          isActive ? 'bg-campo-700 text-white' : 'text-stone-800 hover:bg-campo-50'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icono className={`size-6 shrink-0 ${isActive ? 'text-white' : 'text-campo-700'}`} aria-hidden />
          <span className="min-w-0">
            <span className="block text-lg leading-tight font-semibold">{texto}</span>
            <span className={`block text-sm leading-snug ${isActive ? 'text-campo-50' : 'text-stone-600'}`}>{ayuda}</span>
          </span>
        </>
      )}
    </NavLink>
  )
}

function Sesion({ usuario }: { usuario: Usuario }) {
  const { cerrarSesion } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="border-t-2 border-stone-200 px-4 py-4">
      <p className="truncate text-base font-semibold text-stone-800">{usuario.nombre ?? usuario.correo ?? usuario.telefono}</p>
      <p className="text-sm text-stone-600">Entraste como {NOMBRE_ROL[usuario.rol].toLowerCase()}</p>
      <button
        type="button"
        onClick={() => {
          cerrarSesion()
          navigate('/')
        }}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-stone-500 px-4 text-base font-semibold text-stone-800 transition hover:bg-stone-100"
      >
        <LogOut className="size-5" aria-hidden />
        Cerrar sesión
      </button>
    </div>
  )
}

function AvisoSinConexion() {
  return (
    <p role="status" className="mx-auto mb-6 flex max-w-3xl items-start gap-3 rounded-xl border-2 border-amber-600 bg-amber-50 px-4 py-3 text-base text-amber-900">
      <WifiOff className="mt-0.5 size-6 shrink-0" aria-hidden />
      <span>
        <strong className="block font-semibold">No hay conexión a internet</strong>
        Revisa tu señal o tu wifi. Lo que ya está en pantalla se puede seguir viendo; para guardar o reservar, espera a que vuelva la conexión.
      </span>
    </p>
  )
}

/** Mientras se descarga una página (con conexión lenta puede tardar) */
function CargandoPagina() {
  return (
    <p role="status" className="flex items-center gap-3 py-16 text-lg text-stone-700">
      <LoaderCircle className="size-7 animate-spin text-campo-700" aria-hidden />
      Cargando la página…
    </p>
  )
}
