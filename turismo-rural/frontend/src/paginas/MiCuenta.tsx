import { useState, type FormEvent } from 'react'
import { NOMBRE_ROL, type Usuario } from '../api/auth'
import { ErrorApi } from '../api/cliente'
import { actualizarMiCuenta } from '../api/usuarios'
import { useAuth } from '../auth/contexto'
import { CORREO_RE, limpiarTelefono, telefonoValido } from '../validacion'
import CampoTexto from '../components/CampoTexto'

type Campo = 'nombre' | 'correo' | 'telefono' | 'contrasena_actual'
type Errores = Partial<Record<Campo, string>>
type Valores = { nombre: string; correo: string; telefono: string }

function valoresDe(usuario: Usuario): Valores {
  return { nombre: usuario.nombre ?? '', correo: usuario.correo ?? '', telefono: usuario.telefono ?? '' }
}

/** Datos tal como se enviarán al backend (vacío -> null) */
function normalizar(v: Valores) {
  return {
    nombre: v.nombre.split(/\s+/).filter(Boolean).join(' ') || null,
    correo: v.correo.trim().toLowerCase() || null,
    telefono: limpiarTelefono(v.telefono) || null,
  }
}

function validar(v: Valores, pideContrasena: boolean, contrasenaActual: string): Errores {
  const errores: Errores = {}
  const correo = v.correo.trim()
  const telefono = v.telefono.trim()

  if (v.nombre.trim().length > 100) errores.nombre = 'Máximo 100 caracteres'

  if (correo && !CORREO_RE.test(correo)) errores.correo = 'El correo no es válido'
  if (telefono && !telefonoValido(telefono)) errores.telefono = 'El teléfono debe tener entre 8 y 15 dígitos'
  if (!correo && !telefono) {
    errores.correo = 'Debes mantener al menos un correo o un teléfono'
    errores.telefono = 'Debes mantener al menos un correo o un teléfono'
  }

  if (pideContrasena && !contrasenaActual) {
    errores.contrasena_actual = 'Ingresa tu contraseña actual para cambiar el correo o teléfono'
  }
  return errores
}

export default function MiCuenta() {
  const { usuario, actualizarUsuario } = useAuth()
  // MiCuenta solo se muestra con sesión iniciada
  const actual = usuario!

  const [valores, setValores] = useState<Valores>(() => valoresDe(actual))
  const [contrasenaActual, setContrasenaActual] = useState('')
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({})
  const [erroresServidor, setErroresServidor] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const datos = normalizar(valores)
  const cambiaAcceso = datos.correo !== actual.correo || datos.telefono !== actual.telefono
  const hayCambios = cambiaAcceso || datos.nombre !== actual.nombre

  const erroresLocales = validar(valores, cambiaAcceso, contrasenaActual)
  const errorDe = (campo: Campo) =>
    erroresServidor[campo] ?? (tocados[campo] ? erroresLocales[campo] : undefined)

  function cambiar(campo: Campo, valor: string) {
    if (campo === 'contrasena_actual') setContrasenaActual(valor)
    else setValores((v) => ({ ...v, [campo]: valor }))
    // Correo y teléfono se validan juntos ("al menos uno"), así que se limpian juntos
    const relacionados: Campo[] = campo === 'correo' || campo === 'telefono' ? ['correo', 'telefono'] : [campo]
    setErroresServidor((e) => ({ ...e, ...Object.fromEntries(relacionados.map((c) => [c, undefined])) }))
    setErrorGeneral(null)
    setExito(false)
  }
  const tocar = (campo: Campo) => setTocados((t) => ({ ...t, [campo]: true }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTocados({ nombre: true, correo: true, telefono: true, contrasena_actual: true })
    if (Object.keys(erroresLocales).length > 0 || !hayCambios) return

    setEnviando(true)
    setErrorGeneral(null)
    try {
      const guardado = await actualizarMiCuenta({
        ...datos,
        ...(cambiaAcceso && { contrasena_actual: contrasenaActual }),
      })
      actualizarUsuario(guardado)
      setValores(valoresDe(guardado))
      setContrasenaActual('')
      setTocados({})
      setExito(true)
    } catch (err) {
      const campo = err instanceof ErrorApi ? err.campo : null
      const mensaje = err instanceof Error ? err.message : 'Ocurrió un error inesperado.'
      if (campo === 'nombre' || campo === 'correo' || campo === 'telefono' || campo === 'contrasena_actual') {
        setErroresServidor({ [campo]: mensaje })
      } else {
        setErrorGeneral(mensaje)
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="w-full max-w-2xl">
      <h2 className="mb-4 text-xl font-bold text-campo-700">Mi cuenta</h2>

      <form onSubmit={onSubmit} noValidate className="rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <dl className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-stone-50 p-4 text-sm">
          <div>
            <dt className="text-stone-500">Rol</dt>
            <dd className="font-medium">{NOMBRE_ROL[actual.rol]}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Miembro desde</dt>
            <dd className="font-medium">{new Date(actual.fecha_creacion).toLocaleDateString('es')}</dd>
          </div>
        </dl>

        <div className="space-y-4">
          <CampoTexto
            id="cuenta-nombre"
            label="Nombre"
            type="text"
            autoComplete="name"
            placeholder="Tu nombre"
            value={valores.nombre}
            error={errorDe('nombre')}
            onChange={(v) => cambiar('nombre', v)}
            onBlur={() => tocar('nombre')}
          />
          <CampoTexto
            id="cuenta-correo"
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            value={valores.correo}
            error={errorDe('correo')}
            onChange={(v) => cambiar('correo', v)}
            onBlur={() => tocar('correo')}
          />
          <CampoTexto
            id="cuenta-telefono"
            label="Teléfono"
            type="tel"
            autoComplete="tel"
            placeholder="+56 9 1234 5678"
            value={valores.telefono}
            error={errorDe('telefono')}
            onChange={(v) => cambiar('telefono', v)}
            onBlur={() => tocar('telefono')}
          />

          {cambiaAcceso && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-3 text-sm text-amber-800">
                Estás cambiando los datos con los que inicias sesión. Confirma con tu contraseña actual.
              </p>
              <CampoTexto
                id="cuenta-contrasena-actual"
                label="Contraseña actual"
                type="password"
                autoComplete="current-password"
                value={contrasenaActual}
                error={errorDe('contrasena_actual')}
                onChange={(v) => cambiar('contrasena_actual', v)}
                onBlur={() => tocar('contrasena_actual')}
              />
            </div>
          )}
        </div>

        {errorGeneral && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorGeneral}
          </p>
        )}
        {exito && (
          <p role="status" className="mt-4 rounded-lg bg-campo-50 px-3 py-2 text-sm text-campo-700">
            Tus datos se guardaron correctamente.
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || !hayCambios}
          className="mt-6 w-full rounded-lg bg-campo-600 py-3 font-medium text-white shadow transition hover:bg-campo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </section>
  )
}
