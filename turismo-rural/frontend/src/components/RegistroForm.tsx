import { useState, type FormEvent } from 'react'
import { registrar, type DatosRegistro, type Usuario } from '../api/auth'
import { ErrorApi } from '../api/cliente'
import { useCamposEmprendimiento } from '../hooks/useCamposEmprendimiento'
import { CORREO_RE, errorNombre, limpiarTelefono, normalizarEmprendimiento, normalizarNombre, telefonoValido } from '../validacion'
import CampoTexto from './CampoTexto'
import EmprendimientoCampos from './EmprendimientoCampos'

type Metodo = 'correo' | 'telefono'
type Campo = 'nombre' | 'contacto' | 'contrasena' | 'confirmacion'
type Errores = Partial<Record<Campo, string>>

function validar(
  metodo: Metodo,
  nombre: string,
  esAnfitrion: boolean,
  contacto: string,
  contrasena: string,
  confirmacion: string,
): Errores {
  const errores: Errores = {}

  // Los visitantes no pueden reservar sin nombre; para los anfitriones es opcional
  const errorDelNombre = errorNombre(nombre, !esAnfitrion)
  if (errorDelNombre) errores.nombre = errorDelNombre

  if (!contacto.trim()) {
    errores.contacto = metodo === 'correo' ? 'Ingresa tu correo' : 'Ingresa tu número de teléfono'
  } else if (metodo === 'correo' && !CORREO_RE.test(contacto.trim())) {
    errores.contacto = 'El correo no es válido'
  } else if (metodo === 'telefono' && !telefonoValido(contacto)) {
    errores.contacto = 'El teléfono debe tener entre 8 y 15 dígitos'
  }

  if (!contrasena) {
    errores.contrasena = 'Ingresa una contraseña'
  } else if (contrasena.length < 8) {
    errores.contrasena = 'Debe tener al menos 8 caracteres'
  } else if (new TextEncoder().encode(contrasena).length > 72) {
    errores.contrasena = 'La contraseña es demasiado larga'
  } else if (!/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
    errores.contrasena = 'Debe contener letras y números'
  }

  if (!confirmacion) {
    errores.confirmacion = 'Repite la contraseña'
  } else if (confirmacion !== contrasena) {
    errores.confirmacion = 'Las contraseñas no coinciden'
  }

  return errores
}

export default function RegistroForm({ onIrALogin }: { onIrALogin: () => void }) {
  const [metodo, setMetodo] = useState<Metodo>('correo')
  const [nombre, setNombre] = useState('')
  const [contacto, setContacto] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [esAnfitrion, setEsAnfitrion] = useState(false)
  const emprendimiento = useCamposEmprendimiento()
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({})
  const [erroresServidor, setErroresServidor] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  const erroresLocales = validar(metodo, nombre, esAnfitrion, contacto, contrasena, confirmacion)
  const errorDe = (campo: Campo) =>
    erroresServidor[campo] ?? (tocados[campo] ? erroresLocales[campo] : undefined)

  const tocar = (campo: Campo) => setTocados((t) => ({ ...t, [campo]: true }))
  const limpiarErrorServidor = (campo: Campo) => {
    setErroresServidor((e) => ({ ...e, [campo]: undefined }))
    setErrorGeneral(null)
  }

  function cambiarMetodo(nuevo: Metodo) {
    if (nuevo === metodo) return
    setMetodo(nuevo)
    setContacto('')
    setTocados((t) => ({ ...t, contacto: false }))
    limpiarErrorServidor('contacto')
  }

  function mostrarErrorServidor(err: ErrorApi) {
    if (err.campo === 'nombre') {
      setErroresServidor({ nombre: err.message })
    } else if (err.campo === 'correo' || err.campo === 'telefono') {
      setErroresServidor({ contacto: err.message })
    } else if (err.campo === 'contrasena') {
      setErroresServidor({ contrasena: err.message })
    } else if (err.campo?.startsWith('emprendimiento.')) {
      const campo = err.campo.slice('emprendimiento.'.length)
      if (!emprendimiento.errorDeServidor(campo, err.message)) setErrorGeneral(err.message)
    } else {
      setErrorGeneral(err.message)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTocados({ nombre: true, contacto: true, contrasena: true, confirmacion: true })
    if (esAnfitrion) emprendimiento.tocarTodos()
    if (Object.keys(erroresLocales).length > 0 || (esAnfitrion && !emprendimiento.valido)) return

    setEnviando(true)
    setErrorGeneral(null)
    try {
      const datos: DatosRegistro = {
        ...(normalizarNombre(nombre) && { nombre: normalizarNombre(nombre) }),
        ...(metodo === 'correo' ? { correo: contacto.trim() } : { telefono: limpiarTelefono(contacto) }),
        contrasena,
        rol: esAnfitrion ? 'anfitrion' : 'visitante',
      }
      if (esAnfitrion) datos.emprendimiento = normalizarEmprendimiento(emprendimiento.valores)
      setUsuario(await registrar(datos))
    } catch (err) {
      if (err instanceof ErrorApi) mostrarErrorServidor(err)
      else setErrorGeneral('Ocurrió un error inesperado. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (usuario) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <h2 className="text-2xl font-bold text-campo-700">¡Cuenta creada!</h2>
        <p className="mt-2 text-stone-600">
          Te registraste con <span className="font-medium">{usuario.correo ?? usuario.telefono}</span>.
        </p>
        {usuario.rol === 'anfitrion' && (
          <p className="mt-2 text-stone-600">
            Tu emprendimiento <span className="font-medium">{emprendimiento.valores.nombre.trim()}</span> ya
            está publicado. Inicia sesión para editarlo o publicar otro.
          </p>
        )}
        <button
          type="button"
          onClick={onIrALogin}
          className="mt-6 w-full rounded-lg bg-campo-600 py-3 font-semibold text-white shadow transition hover:bg-campo-700"
        >
          Iniciar sesión
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-campo-700">Crear cuenta</h2>
      <p className="mt-1 text-sm text-stone-600">Regístrate con tu correo o tu número de teléfono.</p>

      <div className="mt-6 grid grid-cols-2 rounded-lg bg-stone-100 p-1 text-sm font-medium" role="tablist">
        {(['correo', 'telefono'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={metodo === m}
            onClick={() => cambiarMetodo(m)}
            className={`rounded-md py-2 transition ${
              metodo === m ? 'bg-white text-campo-700 shadow' : 'text-stone-600 hover:text-stone-700'
            }`}
          >
            {m === 'correo' ? 'Correo' : 'Teléfono'}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        <CampoTexto
          id="nombre"
          label={esAnfitrion ? 'Tu nombre (opcional)' : 'Tu nombre'}
          type="text"
          autoComplete="name"
          maxLength={100}
          placeholder="Nombre y apellido"
          ayuda={esAnfitrion ? 'Lo necesitarás si reservas experiencias de otros anfitriones.' : 'El anfitrión lo verá en tus reservas.'}
          value={nombre}
          error={errorDe('nombre')}
          onChange={(v) => {
            setNombre(v)
            limpiarErrorServidor('nombre')
          }}
          onBlur={() => tocar('nombre')}
        />
        <CampoTexto
          id="contacto"
          label={metodo === 'correo' ? 'Correo electrónico' : 'Número de teléfono'}
          type={metodo === 'correo' ? 'email' : 'tel'}
          autoComplete={metodo === 'correo' ? 'email' : 'tel'}
          placeholder={metodo === 'correo' ? 'tu@correo.com' : '+56 9 1234 5678'}
          value={contacto}
          error={errorDe('contacto')}
          onChange={(v) => {
            setContacto(v)
            limpiarErrorServidor('contacto')
          }}
          onBlur={() => tocar('contacto')}
        />
        <CampoTexto
          id="contrasena"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres, con letras y números"
          value={contrasena}
          error={errorDe('contrasena')}
          onChange={(v) => {
            setContrasena(v)
            limpiarErrorServidor('contrasena')
          }}
          onBlur={() => tocar('contrasena')}
        />
        <CampoTexto
          id="confirmacion"
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          value={confirmacion}
          error={errorDe('confirmacion')}
          onChange={setConfirmacion}
          onBlur={() => tocar('confirmacion')}
        />
      </div>

      <button
        type="button"
        aria-pressed={esAnfitrion}
        aria-controls="datos-emprendimiento"
        onClick={() => {
          setEsAnfitrion((v) => !v)
          setErrorGeneral(null)
        }}
        className={`mt-6 flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition ${
          esAnfitrion
            ? 'border-campo-500 bg-campo-50 text-campo-700'
            : 'border-stone-400 text-stone-600 hover:border-campo-500'
        }`}
      >
        <span
          aria-hidden
          className={`flex size-5 shrink-0 items-center justify-center rounded border-2 text-sm font-bold ${
            esAnfitrion ? 'border-campo-600 bg-campo-600 text-white' : 'border-stone-300'
          }`}
        >
          {esAnfitrion && '✓'}
        </span>
        <span>
          <span className="block font-medium">Soy anfitrión</span>
          <span className="block text-sm text-stone-600">Quiero publicar mi emprendimiento turístico</span>
        </span>
      </button>

      {esAnfitrion && (
        <fieldset id="datos-emprendimiento" className="mt-4 rounded-lg border border-stone-200 p-4">
          <legend className="px-1 text-sm font-medium text-campo-700">Datos de tu emprendimiento</legend>
          <EmprendimientoCampos campos={emprendimiento} idPrefijo="registro-emp" />
        </fieldset>
      )}

      {errorGeneral && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorGeneral}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 w-full rounded-lg bg-campo-600 py-3 font-semibold text-white shadow transition hover:bg-campo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? 'Creando cuenta…' : esAnfitrion ? 'Crear cuenta de anfitrión' : 'Crear cuenta'}
      </button>

      <p className="mt-4 text-center text-sm text-stone-600">
        ¿Ya tienes cuenta?{' '}
        <button type="button" onClick={onIrALogin} className="font-medium text-campo-600 hover:underline">
          Inicia sesión
        </button>
      </p>
    </form>
  )
}
