import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/contexto'
import { CORREO_RE, telefonoValido } from '../validacion'
import CampoTexto from './CampoTexto'

type Campo = 'identificador' | 'contrasena'
type Errores = Partial<Record<Campo, string>>

function validar(identificador: string, contrasena: string): Errores {
  const errores: Errores = {}
  const valor = identificador.trim()

  if (!valor) {
    errores.identificador = 'Ingresa tu correo o teléfono'
  } else if (valor.includes('@')) {
    if (!CORREO_RE.test(valor)) errores.identificador = 'El correo no es válido'
  } else if (!telefonoValido(valor)) {
    errores.identificador = 'Ingresa un correo o un teléfono válido'
  }

  if (!contrasena) errores.contrasena = 'Ingresa tu contraseña'

  return errores
}

export default function LoginForm({ onIrARegistro }: { onIrARegistro: () => void }) {
  const { iniciarSesion } = useAuth()
  const [identificador, setIdentificador] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const errores = validar(identificador, contrasena)
  const errorDe = (campo: Campo) => (tocados[campo] ? errores[campo] : undefined)
  const tocar = (campo: Campo) => setTocados((t) => ({ ...t, [campo]: true }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTocados({ identificador: true, contrasena: true })
    if (Object.keys(errores).length > 0) return

    setEnviando(true)
    setErrorGeneral(null)
    try {
      await iniciarSesion({ identificador: identificador.trim(), contrasena })
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : 'Ocurrió un error inesperado.')
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-campo-700">Iniciar sesión</h2>
      <p className="mt-1 text-sm text-stone-500">Accede con tu correo o tu número de teléfono.</p>

      <div className="mt-6 space-y-4">
        <CampoTexto
          id="identificador"
          label="Correo o teléfono"
          type="text"
          autoComplete="username"
          placeholder="tu@correo.com o +56 9 1234 5678"
          value={identificador}
          error={errorDe('identificador')}
          onChange={(v) => {
            setIdentificador(v)
            setErrorGeneral(null)
          }}
          onBlur={() => tocar('identificador')}
        />
        <CampoTexto
          id="contrasena"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={contrasena}
          error={errorDe('contrasena')}
          onChange={(v) => {
            setContrasena(v)
            setErrorGeneral(null)
          }}
          onBlur={() => tocar('contrasena')}
        />
      </div>

      {errorGeneral && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorGeneral}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 w-full rounded-lg bg-campo-600 py-3 font-medium text-white shadow transition hover:bg-campo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? 'Entrando…' : 'Iniciar sesión'}
      </button>

      <p className="mt-4 text-center text-sm text-stone-500">
        ¿No tienes cuenta?{' '}
        <button type="button" onClick={onIrARegistro} className="font-medium text-campo-600 hover:underline">
          Regístrate
        </button>
      </p>
    </form>
  )
}
