import { ArrowLeft, CircleCheck, ExternalLink, Eye, ImagePlus, Trash2, Undo2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorApi, urlArchivo } from '../api/cliente'
import {
  obtenerEmprendimiento,
  personalizarEmprendimiento,
  quitarPortadaEmprendimiento,
  subirPortadaEmprendimiento,
  type Emprendimiento,
  type TipoBloque,
} from '../api/emprendimientos'
import { mensajeDeError } from '../api/errores'
import { useAuth } from '../auth/contexto'
import CampoArea from '../components/CampoArea'
import ErrorCarga from '../components/ErrorCarga'
import FichaEmprendimiento from '../components/FichaEmprendimiento'
import PestanasVistaPrevia, { type VistaMovil } from '../components/PestanasVistaPrevia'
import SelectorPaleta from '../components/SelectorPaleta'
import { BLOQUES_INFO, datosFicha, MAX_BLOQUE, MAX_RELATO, TIPOS_BLOQUE } from '../fichaEmprendimiento'
import { useCarga } from '../hooks/useCarga'
import { MAX_IMAGEN_MB, useImagenPendiente } from '../hooks/useImagenPendiente'

export default function PersonalizarEmprendimiento() {
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
          error={new Error('Solo el dueño puede personalizar este emprendimiento.')}
          titulo="No tienes permiso para personalizar este emprendimiento"
        />
      ) : (
        <FormularioPersonalizacion key={datos.id} emprendimiento={datos} onGuardado={setDatos} />
      )}
    </section>
  )
}

type EstadoBloques = Record<TipoBloque, { activo: boolean; contenido: string }>

function bloquesIniciales(e: Emprendimiento): EstadoBloques {
  return Object.fromEntries(
    TIPOS_BLOQUE.map((tipo) => [tipo, { activo: e.bloques[tipo].activo, contenido: e.bloques[tipo].contenido ?? '' }]),
  ) as EstadoBloques
}

function Interruptor({ activo, etiqueta, onCambiar }: { activo: boolean; etiqueta: string; onCambiar: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={onCambiar}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:ring-2 focus-visible:ring-campo-500 focus-visible:ring-offset-2 focus-visible:outline-none ${
        activo ? 'bg-campo-600' : 'bg-stone-300'
      }`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition ${activo ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function FormularioPersonalizacion({
  emprendimiento,
  onGuardado,
}: {
  emprendimiento: Emprendimiento
  onGuardado: (e: Emprendimiento) => void
}) {
  const [colores, setColores] = useState({ primario: emprendimiento.color_primario, secundario: emprendimiento.color_secundario })
  const [relato, setRelato] = useState(emprendimiento.relato_comunidad ?? '')
  const [bloques, setBloques] = useState<EstadoBloques>(() => bloquesIniciales(emprendimiento))
  const portada = useImagenPendiente()
  const [quitarPortada, setQuitarPortada] = useState(false)

  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [erroresServidor, setErroresServidor] = useState<Record<string, string | undefined>>({})
  const [vistaMovil, setVistaMovil] = useState<VistaMovil>('editar')
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  function marcarCambio() {
    setGuardado(false)
    setErrorGeneral(null)
  }

  const errorRelato = erroresServidor.relato_comunidad ?? (relato.length > MAX_RELATO ? `Máximo ${MAX_RELATO} caracteres` : undefined)
  const errorColores = erroresServidor.color_primario ?? erroresServidor.color_secundario

  function errorBloqueLocal(tipo: TipoBloque): string | undefined {
    const { activo, contenido } = bloques[tipo]
    if (contenido.length > MAX_BLOQUE) return `Máximo ${MAX_BLOQUE} caracteres`
    // Solo tras intentar guardar, para no marcar en rojo un bloque recién activado
    if (activo && !contenido.trim() && intentoGuardar) return 'Escribe el contenido o desactiva este bloque'
  }
  const errorBloque = (tipo: TipoBloque) => erroresServidor[`bloques.${tipo}`] ?? errorBloqueLocal(tipo)

  function cambiarBloque(tipo: TipoBloque, cambios: Partial<EstadoBloques[TipoBloque]>) {
    setBloques((b) => ({ ...b, [tipo]: { ...b[tipo], ...cambios } }))
    setErroresServidor((e) => ({ ...e, [`bloques.${tipo}`]: undefined }))
    marcarCambio()
  }

  function elegirPortada(input: HTMLInputElement) {
    if (input.files?.length) {
      marcarCambio()
      setQuitarPortada(false)
    }
    portada.elegir(input)
  }

  function mostrarErrorServidor(err: unknown) {
    const campo = err instanceof ErrorApi ? err.campo : null
    const mensaje = mensajeDeError(err)
    if (campo === 'relato_comunidad' || campo?.startsWith('color_') || campo?.startsWith('bloques.')) {
      // Un error dentro de un bloque (p. ej. "bloques.gastronomia.contenido") se muestra en el bloque
      const clave = campo.startsWith('bloques.') ? campo.split('.').slice(0, 2).join('.') : campo
      setErroresServidor((e) => ({ ...e, [clave]: mensaje }))
      return
    }
    setErrorGeneral(mensaje)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setIntentoGuardar(true)
    const bloquesValidos = TIPOS_BLOQUE.every((tipo) => {
      const { activo, contenido } = bloques[tipo]
      return contenido.length <= MAX_BLOQUE && (!activo || contenido.trim())
    })
    if (relato.length > MAX_RELATO || !bloquesValidos) {
      setVistaMovil('editar')
      setErrorGeneral('Revisa los campos marcados en rojo.')
      return
    }

    setEnviando(true)
    setErrorGeneral(null)
    setErroresServidor({})
    let actualizado: Emprendimiento
    try {
      actualizado = await personalizarEmprendimiento(emprendimiento.id, {
        color_primario: colores.primario,
        color_secundario: colores.secundario,
        relato_comunidad: relato.trim() || null,
        bloques: Object.fromEntries(
          TIPOS_BLOQUE.map((tipo) => [tipo, { activo: bloques[tipo].activo, contenido: bloques[tipo].contenido.trim() || null }]),
        ) as Emprendimiento['bloques'],
      })
    } catch (err) {
      mostrarErrorServidor(err)
      setEnviando(false)
      return
    }

    try {
      if (portada.pendiente) {
        actualizado = await subirPortadaEmprendimiento(emprendimiento.id, portada.pendiente.archivo)
        portada.descartar()
      } else if (quitarPortada) {
        actualizado = await quitarPortadaEmprendimiento(emprendimiento.id)
        setQuitarPortada(false)
      }
    } catch (err) {
      portada.setError(`Los demás cambios se guardaron, pero la portada no se pudo actualizar: ${mensajeDeError(err)}`)
    }

    onGuardado(actualizado)
    setEnviando(false)
    setGuardado(true)
  }

  const portadaGuardada = quitarPortada ? null : urlArchivo(emprendimiento.portada_url)
  const portadaMostrada = portada.pendiente?.url ?? portadaGuardada

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-campo-700">Personalizar página</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/emprendimientos/${emprendimiento.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            <ExternalLink className="size-4" aria-hidden />
            Ver página pública
          </Link>
          <PestanasVistaPrevia vista={vistaMovil} onCambiar={setVistaMovil} />
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <form
          onSubmit={onSubmit}
          noValidate
          className={`space-y-8 rounded-2xl bg-white p-6 shadow-lg ${vistaMovil === 'previa' ? 'hidden lg:block' : ''}`}
        >
          <fieldset>
            <legend className="mb-1 font-semibold text-stone-800">Paleta de colores</legend>
            <p className="mb-3 text-sm text-stone-500">Se usará en la portada, los títulos y los botones de tu página.</p>
            <SelectorPaleta
              primario={colores.primario}
              secundario={colores.secundario}
              onCambiar={(primario, secundario) => {
                setColores({ primario, secundario })
                setErroresServidor((e) => ({ ...e, color_primario: undefined, color_secundario: undefined }))
                marcarCambio()
              }}
            />
            {errorColores && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {errorColores}
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-1 font-semibold text-stone-800">Foto de portada</legend>
            <p className="mb-3 text-sm text-stone-500">Una imagen horizontal y amplia: el paisaje, la casa, la huerta.</p>
            <div className="relative aspect-[3/1] overflow-hidden rounded-xl bg-stone-100">
              {portadaMostrada ? (
                <img src={portadaMostrada} alt="Foto de portada" className="size-full object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 text-stone-400">
                  <ImagePlus className="size-8" aria-hidden />
                  <span className="text-sm">Sin portada: se mostrará un degradado con tus colores</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <input
                id="portada"
                type="file"
                accept={portada.tipos}
                onChange={(e) => elegirPortada(e.target)}
                className="sr-only"
                aria-describedby="portada-ayuda"
              />
              <label
                htmlFor="portada"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                <ImagePlus className="size-4" aria-hidden />
                {portadaMostrada ? 'Cambiar portada' : 'Subir portada'}
              </label>
              {portada.pendiente ? (
                <button type="button" onClick={portada.descartar} className="text-sm text-stone-500 hover:text-stone-700 hover:underline">
                  Descartar
                </button>
              ) : emprendimiento.portada_url && !quitarPortada ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuitarPortada(true)
                    marcarCambio()
                  }}
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Quitar portada
                </button>
              ) : (
                quitarPortada && (
                  <button
                    type="button"
                    onClick={() => setQuitarPortada(false)}
                    className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 hover:underline"
                  >
                    <Undo2 className="size-4" aria-hidden />
                    Deshacer
                  </button>
                )
              )}
            </div>
            <p id="portada-ayuda" className="mt-1 text-xs text-stone-500">
              {portada.pendiente
                ? `${portada.pendiente.archivo.name} · se subirá al guardar`
                : quitarPortada
                  ? 'La portada se quitará al guardar'
                  : `JPG, PNG o WebP, hasta ${MAX_IMAGEN_MB} MB`}
            </p>
            {portada.error && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {portada.error}
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-3 font-semibold text-stone-800">Relato de la comunidad</legend>
            <CampoArea
              id="relato-comunidad"
              label="¿Qué hace única a tu comunidad?"
              value={relato}
              maxLength={MAX_RELATO}
              filas={6}
              placeholder="Su gente, sus oficios, el paisaje, las tradiciones que se mantienen vivas…"
              error={errorRelato}
              onChange={(v) => {
                setRelato(v)
                setErroresServidor((e) => ({ ...e, relato_comunidad: undefined }))
                marcarCambio()
              }}
              onBlur={() => {}}
            />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 font-semibold text-stone-800">Bloques opcionales</legend>
            <p className="text-sm text-stone-500">
              Activa los que quieras mostrar. Si desactivas uno, el texto se guarda para cuando lo vuelvas a activar.
            </p>
            {TIPOS_BLOQUE.map((tipo) => {
              const { titulo, descripcion, placeholder, Icono } = BLOQUES_INFO[tipo]
              const { activo, contenido } = bloques[tipo]
              return (
                <div key={tipo} className={`rounded-xl border p-4 transition ${activo ? 'border-campo-500/40 bg-campo-50/40' : 'border-stone-200'}`}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600">
                      <Icono className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-800">{titulo}</p>
                      <p className="text-sm text-stone-500">{descripcion}</p>
                    </div>
                    <Interruptor
                      activo={activo}
                      etiqueta={`Mostrar ${titulo.toLowerCase()}`}
                      onCambiar={() => cambiarBloque(tipo, { activo: !activo })}
                    />
                  </div>
                  {activo ? (
                    <div className="mt-3">
                      <CampoArea
                        id={`bloque-${tipo}`}
                        label={`Contenido de ${titulo.toLowerCase()}`}
                        value={contenido}
                        maxLength={MAX_BLOQUE}
                        placeholder={placeholder}
                        error={errorBloque(tipo)}
                        onChange={(v) => cambiarBloque(tipo, { contenido: v })}
                        onBlur={() => {}}
                      />
                    </div>
                  ) : (
                    contenido.trim() && <p className="mt-2 text-xs text-stone-400 italic">Oculto en tu página. El texto se conserva.</p>
                  )}
                </div>
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

        <aside aria-label="Vista previa" className={`lg:sticky lg:top-6 ${vistaMovil === 'editar' ? 'hidden lg:block' : ''}`}>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-stone-500">
            <Eye className="size-4" aria-hidden />
            Vista previa: así verán tu página los visitantes
          </p>
          <FichaEmprendimiento
            previa
            datos={{
              ...datosFicha(emprendimiento),
              colorPrimario: colores.primario,
              colorSecundario: colores.secundario,
              portadaUrl: portadaMostrada,
              relatoComunidad: relato,
              bloques,
            }}
          />
        </aside>
      </div>
    </>
  )
}
