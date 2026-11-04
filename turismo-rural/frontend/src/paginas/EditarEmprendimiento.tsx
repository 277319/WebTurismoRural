import { ArrowLeft, CircleCheck, Eye, ImagePlus, Pencil } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorApi, urlArchivo } from '../api/cliente'
import {
  editarEmprendimiento,
  obtenerEmprendimiento,
  subirFotoEmprendimiento,
  type Emprendimiento,
} from '../api/emprendimientos'
import { mensajeDeError } from '../api/errores'
import { useAuth } from '../auth/contexto'
import CampoArea from '../components/CampoArea'
import CampoTexto from '../components/CampoTexto'
import EmprendimientoCampos from '../components/EmprendimientoCampos'
import ErrorCarga from '../components/ErrorCarga'
import VistaPreviaEmprendimiento from '../components/VistaPreviaEmprendimiento'
import { useCamposEmprendimiento } from '../hooks/useCamposEmprendimiento'
import { useCarga } from '../hooks/useCarga'
import { REDES_INFO } from '../redes'
import {
  CAMPOS_REDES,
  limpiarTelefono,
  normalizarEmprendimiento,
  normalizarRedes,
  validarRedes,
  type CampoRed,
  type ValoresRedes,
} from '../validacion'

const MAX_DESCRIPCION = 2000
const MAX_HISTORIA = 5000
const MAX_FOTO_MB = 5
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']

export default function EditarEmprendimiento() {
  const { id } = useParams()
  const emprendimientoId = Number(id)
  const { usuario } = useAuth()
  const { datos, error, cargando, recargar, setDatos } = useCarga(
    () => obtenerEmprendimiento(emprendimientoId),
    [emprendimientoId],
  )

  return (
    <section className="w-full">
      <Link
        to="/mis-emprendimientos"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-campo-600 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mis emprendimientos
      </Link>

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar el emprendimiento" onReintentar={recargar} />
      ) : !datos ? (
        <p className="text-stone-500">Cargando…</p>
      ) : datos.usuario_id !== usuario?.id ? (
        <ErrorCarga
          error={new Error('Solo el dueño puede editar este emprendimiento.')}
          titulo="No tienes permiso para editar este emprendimiento"
        />
      ) : (
        // key: si cambia el id, el formulario se reinicia con los nuevos datos
        <FormularioEdicion key={datos.id} emprendimiento={datos} onGuardado={setDatos} />
      )}
    </section>
  )
}

function redesIniciales(e: Emprendimiento): ValoresRedes {
  return Object.fromEntries(CAMPOS_REDES.map((red) => [red, e.redes[red] ?? ''])) as ValoresRedes
}

type CampoTextoLargo = 'descripcion' | 'historia'

function FormularioEdicion({
  emprendimiento,
  onGuardado,
}: {
  emprendimiento: Emprendimiento
  onGuardado: (e: Emprendimiento) => void
}) {
  const basicos = useCamposEmprendimiento({
    nombre: emprendimiento.nombre,
    telefono_contacto: emprendimiento.telefono_contacto,
    direccion: emprendimiento.direccion,
    localidad: emprendimiento.localidad,
  })
  const [textos, setTextos] = useState<Record<CampoTextoLargo, string>>({
    descripcion: emprendimiento.descripcion ?? '',
    historia: emprendimiento.historia ?? '',
  })
  const [redes, setRedes] = useState<ValoresRedes>(() => redesIniciales(emprendimiento))
  const [tocadosRedes, setTocadosRedes] = useState<Partial<Record<CampoRed, boolean>>>({})
  const [erroresServidor, setErroresServidor] = useState<Record<string, string | undefined>>({})

  // Foto elegida pero aún no subida, con su URL temporal para la vista previa
  const [fotoNueva, setFotoNueva] = useState<{ archivo: File; url: string } | null>(null)
  const urlTemporal = useRef<string | null>(null)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const inputFoto = useRef<HTMLInputElement>(null)

  const [vistaMovil, setVistaMovil] = useState<'editar' | 'previa'>('editar')
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  function cambiarFotoNueva(archivo: File | null) {
    if (urlTemporal.current) URL.revokeObjectURL(urlTemporal.current)
    const url = archivo ? URL.createObjectURL(archivo) : null
    urlTemporal.current = url
    setFotoNueva(archivo && url ? { archivo, url } : null)
  }

  // Libera la URL temporal al salir de la página
  useEffect(() => () => {
    if (urlTemporal.current) URL.revokeObjectURL(urlTemporal.current)
  }, [])

  const erroresRedes = validarRedes(redes)
  const errorTexto = (campo: CampoTextoLargo, max: number) =>
    erroresServidor[campo] ?? (textos[campo].length > max ? `Máximo ${max} caracteres` : undefined)
  const errorRed = (red: CampoRed) =>
    erroresServidor[`redes.${red}`] ?? (tocadosRedes[red] ? erroresRedes[red] : undefined)

  function marcarCambio() {
    setGuardado(false)
    setErrorGeneral(null)
  }

  function elegirFoto(archivo: File | undefined) {
    if (inputFoto.current) inputFoto.current.value = '' // permite volver a elegir el mismo archivo
    if (!archivo) return
    marcarCambio()
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setErrorFoto('La foto debe ser JPG, PNG o WebP.')
      return
    }
    if (archivo.size > MAX_FOTO_MB * 1024 * 1024) {
      setErrorFoto(`La foto no puede superar los ${MAX_FOTO_MB} MB.`)
      return
    }
    setErrorFoto(null)
    cambiarFotoNueva(archivo)
  }

  function mostrarErrorServidor(err: unknown) {
    const campo = err instanceof ErrorApi ? err.campo : null
    const mensaje = mensajeDeError(err)
    if (campo && basicos.errorDeServidor(campo, mensaje)) return
    if (campo === 'descripcion' || campo === 'historia' || campo?.startsWith('redes.')) {
      setErroresServidor((e) => ({ ...e, [campo]: mensaje }))
      return
    }
    setErrorGeneral(mensaje)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    basicos.tocarTodos()
    setTocadosRedes(Object.fromEntries(CAMPOS_REDES.map((r) => [r, true])))
    const textosValidos = textos.descripcion.length <= MAX_DESCRIPCION && textos.historia.length <= MAX_HISTORIA
    if (!basicos.valido || Object.keys(erroresRedes).length > 0 || !textosValidos) {
      setVistaMovil('editar')
      setErrorGeneral('Revisa los campos marcados en rojo.')
      return
    }

    setEnviando(true)
    setErrorGeneral(null)
    setErroresServidor({})
    let actualizado: Emprendimiento
    try {
      actualizado = await editarEmprendimiento(emprendimiento.id, {
        ...normalizarEmprendimiento(basicos.valores),
        descripcion: textos.descripcion.trim() || null,
        historia: textos.historia.trim() || null,
        redes: normalizarRedes(redes),
      })
    } catch (err) {
      mostrarErrorServidor(err)
      setEnviando(false)
      return
    }

    if (fotoNueva) {
      try {
        actualizado = await subirFotoEmprendimiento(emprendimiento.id, fotoNueva.archivo)
        cambiarFotoNueva(null)
      } catch (err) {
        setErrorFoto(`Los datos se guardaron, pero la foto no se pudo subir: ${mensajeDeError(err)}`)
      }
    }

    onGuardado(actualizado)
    setRedes(redesIniciales(actualizado)) // muestra las redes ya normalizadas (p. ej. URL -> usuario)
    setEnviando(false)
    setGuardado(true)
  }

  const fotoMostrada = fotoNueva?.url ?? urlArchivo(emprendimiento.foto_url)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-campo-700">Editar emprendimiento</h1>
        {/* En pantallas pequeñas se alterna entre el formulario y la vista previa */}
        <div className="grid grid-cols-2 rounded-lg bg-stone-200/60 p-1 text-sm font-medium lg:hidden" role="tablist">
          {(['editar', 'previa'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vistaMovil === v}
              onClick={() => setVistaMovil(v)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                vistaMovil === v ? 'bg-white text-campo-700 shadow' : 'text-stone-600'
              }`}
            >
              {v === 'editar' ? <Pencil className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {v === 'editar' ? 'Editar' : 'Vista previa'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <form
          onSubmit={onSubmit}
          noValidate
          className={`space-y-6 rounded-2xl bg-white p-6 shadow-lg ${vistaMovil === 'previa' ? 'hidden lg:block' : ''}`}
        >
          <fieldset>
            <legend className="mb-3 font-semibold text-stone-800">Foto de perfil</legend>
            <div className="flex items-center gap-4">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-campo-100 text-campo-500">
                {fotoMostrada ? (
                  <img src={fotoMostrada} alt="Foto de perfil" className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-8" aria-hidden />
                )}
              </div>
              <div>
                <input
                  ref={inputFoto}
                  id="foto"
                  type="file"
                  accept={TIPOS_FOTO.join(',')}
                  onChange={(e) => elegirFoto(e.target.files?.[0])}
                  className="sr-only"
                  aria-describedby="foto-ayuda"
                />
                <label
                  htmlFor="foto"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  <ImagePlus className="size-4" aria-hidden />
                  {fotoMostrada ? 'Cambiar foto' : 'Subir foto'}
                </label>
                {fotoNueva && (
                  <button
                    type="button"
                    onClick={() => cambiarFotoNueva(null)}
                    className="ml-2 text-sm text-stone-500 hover:text-stone-700 hover:underline"
                  >
                    Descartar
                  </button>
                )}
                <p id="foto-ayuda" className="mt-1 text-xs text-stone-500">
                  {fotoNueva ? `${fotoNueva.archivo.name} · se subirá al guardar` : `JPG, PNG o WebP, hasta ${MAX_FOTO_MB} MB`}
                </p>
              </div>
            </div>
            {errorFoto && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {errorFoto}
              </p>
            )}
          </fieldset>

          <fieldset onChange={marcarCambio}>
            <legend className="mb-3 font-semibold text-stone-800">Datos básicos</legend>
            <EmprendimientoCampos campos={basicos} idPrefijo="editar-emp" />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-3 font-semibold text-stone-800">Presentación</legend>
            {(
              [
                ['descripcion', 'Descripción', MAX_DESCRIPCION, 4, '¿Qué ofreces? ¿Qué hace especial a tu emprendimiento?'],
                ['historia', 'Historia', MAX_HISTORIA, 6, '¿Cómo empezó todo? ¿Quiénes están detrás?'],
              ] as const
            ).map(([campo, label, max, filas, placeholder]) => (
              <CampoArea
                key={campo}
                id={`emp-${campo}`}
                label={label}
                value={textos[campo]}
                maxLength={max}
                filas={filas}
                placeholder={placeholder}
                error={errorTexto(campo, max)}
                onChange={(v) => {
                  setTextos((t) => ({ ...t, [campo]: v }))
                  setErroresServidor((e) => ({ ...e, [campo]: undefined }))
                  marcarCambio()
                }}
                onBlur={() => {}}
              />
            ))}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 font-semibold text-stone-800">Redes de contacto</legend>
            <p className="text-sm text-stone-500">Todas son opcionales. Puedes pegar el enlace de tu perfil.</p>
            {CAMPOS_REDES.map((red) => {
              const { nombre, Icono, placeholder, prefijo } = REDES_INFO[red]
              return (
                <CampoTexto
                  key={red}
                  id={`red-${red}`}
                  label={nombre}
                  type={red === 'whatsapp' ? 'tel' : red === 'sitio_web' ? 'url' : 'text'}
                  inputMode={red === 'whatsapp' ? 'tel' : red === 'sitio_web' ? 'url' : undefined}
                  autoComplete="off"
                  placeholder={placeholder}
                  prefijo={prefijo ?? <Icono className="size-4" aria-hidden />}
                  value={redes[red]}
                  error={errorRed(red)}
                  onChange={(v) => {
                    setRedes((r) => ({ ...r, [red]: v }))
                    setErroresServidor((e) => ({ ...e, [`redes.${red}`]: undefined }))
                    marcarCambio()
                  }}
                  onBlur={() => setTocadosRedes((t) => ({ ...t, [red]: true }))}
                />
              )
            })}
          </fieldset>

          {errorGeneral && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorGeneral}
            </p>
          )}
          {guardado && (
            <p role="status" className="flex items-center gap-2 rounded-lg bg-campo-50 px-3 py-2 text-sm text-campo-700">
              <CircleCheck className="size-4" aria-hidden />
              Cambios guardados.
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-campo-600 py-3 font-medium text-white shadow transition hover:bg-campo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>

        <aside
          aria-label="Vista previa"
          className={`lg:sticky lg:top-6 ${vistaMovil === 'editar' ? 'hidden lg:block' : ''}`}
        >
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-stone-500">
            <Eye className="size-4" aria-hidden />
            Vista previa: así verán tu emprendimiento los visitantes
          </p>
          <VistaPreviaEmprendimiento
            nombre={basicos.valores.nombre}
            localidad={basicos.valores.localidad}
            direccion={basicos.valores.direccion}
            telefono={basicos.valores.telefono_contacto.trim() ? limpiarTelefono(basicos.valores.telefono_contacto) : ''}
            descripcion={textos.descripcion}
            historia={textos.historia}
            redes={normalizarRedes(redes)}
            fotoUrl={fotoMostrada}
          />
        </aside>
      </div>
    </>
  )
}
