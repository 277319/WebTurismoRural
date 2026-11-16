import { ArrowLeft, ChevronLeft, ChevronRight, GripVertical, ImagePlus, LoaderCircle, RotateCw, Star, Trash2, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorApi, urlArchivo } from '../api/cliente'
import { mensajeDeError } from '../api/errores'
import {
  eliminarFotoExperiencia,
  MAX_FOTO_EXPERIENCIA_MB,
  MAX_FOTOS_EXPERIENCIA,
  misExperiencias,
  reordenarFotosExperiencia,
  subirFotoExperiencia,
  type Experiencia,
  type FotoExperiencia,
} from '../api/experiencias'
import ErrorCarga from '../components/ErrorCarga'
import { useCarga } from '../hooks/useCarga'
import { errorImagen, TIPOS_IMAGEN } from '../hooks/useImagenPendiente'

export default function GaleriaExperiencia() {
  const { id } = useParams()
  const experienciaId = Number(id)
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const experiencia = (await misExperiencias()).find((e) => e.id === experienciaId)
    if (!experiencia) throw new ErrorApi('No encontramos esta experiencia entre las tuyas.', null, 404)
    return experiencia
  }, [experienciaId])

  return (
    <section className="w-full max-w-4xl">
      <Link to="/mis-experiencias" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-campo-600 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Mis experiencias
      </Link>

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar la galería" onReintentar={recargar} />
      ) : !datos ? (
        <p className="text-stone-600">Cargando…</p>
      ) : (
        <EditorGaleria key={datos.id} experiencia={datos} />
      )}
    </section>
  )
}

/** Foto elegida en el PC que se está subiendo (o que falló), con una URL temporal para verla mientras tanto */
type Subida = { clave: number; archivo: File; vista: string; error: string | null }

const esArrastreDeArchivos = (e: DragEvent) => e.dataTransfer.types.includes('Files')

function EditorGaleria({ experiencia }: { experiencia: Experiencia }) {
  const [fotos, setFotos] = useState<FotoExperiencia[]>(experiencia.fotos)
  const [subidas, setSubidas] = useState<Subida[]>([])
  const [subiendo, setSubiendo] = useState<number | null>(null)
  // Guardando el orden o eliminando una foto
  const [ocupado, setOcupado] = useState(false)
  const [avisos, setAvisos] = useState<string[]>([])
  const [confirmarId, setConfirmarId] = useState<number | null>(null)
  // Reordenar arrastrando: índice de la foto tomada y de la posición sobre la que está
  const [arrastrada, setArrastrada] = useState<number | null>(null)
  const [destino, setDestino] = useState<number | null>(null)
  const [soltandoArchivos, setSoltandoArchivos] = useState(false)

  // Las fotos se suben de a una, en el orden en que se eligieron
  const cola = useRef<Subida[]>([])
  const procesando = useRef(false)
  const siguienteClave = useRef(0)
  const urlsTemporales = useRef(new Set<string>())

  useEffect(() => {
    const urls = urlsTemporales.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const enCurso = subidas.filter((s) => !s.error).length
  const libres = MAX_FOTOS_EXPERIENCIA - fotos.length - enCurso
  // Reordenar o eliminar mientras se sube otra foto podría pisar los cambios: se espera a que termine
  const bloqueado = ocupado || enCurso > 0

  function quitarSubida(subida: Subida) {
    URL.revokeObjectURL(subida.vista)
    urlsTemporales.current.delete(subida.vista)
    setSubidas((s) => s.filter((x) => x.clave !== subida.clave))
  }

  async function procesarCola() {
    if (procesando.current) return
    procesando.current = true
    let subida: Subida | undefined
    while ((subida = cola.current.shift())) {
      const actual = subida
      setSubiendo(actual.clave)
      try {
        const foto = await subirFotoExperiencia(experiencia.id, actual.archivo)
        setFotos((f) => [...f, foto])
        quitarSubida(actual)
      } catch (err) {
        setSubidas((s) => s.map((x) => (x.clave === actual.clave ? { ...x, error: mensajeDeError(err) } : x)))
      }
    }
    setSubiendo(null)
    procesando.current = false
  }

  function encolar(nuevas: Subida[]) {
    cola.current.push(...nuevas)
    void procesarCola()
  }

  function agregarArchivos(archivos: File[]) {
    if (archivos.length === 0) return
    const rechazos: string[] = []
    const validos: File[] = []
    for (const archivo of archivos) {
      const problema = errorImagen(archivo, MAX_FOTO_EXPERIENCIA_MB)
      if (problema) rechazos.push(`${archivo.name}: ${problema}`)
      else validos.push(archivo)
    }
    const aceptados = validos.slice(0, Math.max(libres, 0))
    const sobrantes = validos.length - aceptados.length
    if (sobrantes > 0) {
      rechazos.push(
        `La galería admite hasta ${MAX_FOTOS_EXPERIENCIA} fotos: ${sobrantes === 1 ? 'una foto quedó fuera' : `${sobrantes} fotos quedaron fuera`}.`,
      )
    }
    setAvisos(rechazos)

    const nuevas = aceptados.map((archivo) => {
      const vista = URL.createObjectURL(archivo)
      urlsTemporales.current.add(vista)
      return { clave: siguienteClave.current++, archivo, vista, error: null }
    })
    setSubidas((s) => [...s, ...nuevas])
    encolar(nuevas)
  }

  function reintentar(subida: Subida) {
    const pendiente = { ...subida, error: null }
    setSubidas((s) => s.map((x) => (x.clave === subida.clave ? pendiente : x)))
    encolar([pendiente])
  }

  async function guardarOrden(nuevas: FotoExperiencia[]) {
    const anteriores = fotos
    setFotos(nuevas)
    setOcupado(true)
    setAvisos([])
    try {
      setFotos(await reordenarFotosExperiencia(experiencia.id, nuevas.map((f) => f.id)))
    } catch (err) {
      setFotos(anteriores)
      setAvisos([`No se pudo guardar el nuevo orden. ${mensajeDeError(err)}`])
    } finally {
      setOcupado(false)
    }
  }

  function mover(desde: number, hasta: number) {
    if (bloqueado || desde === hasta || hasta < 0 || hasta >= fotos.length) return
    const nuevas = [...fotos]
    const [foto] = nuevas.splice(desde, 1)
    nuevas.splice(hasta, 0, foto)
    void guardarOrden(nuevas)
  }

  async function eliminar(foto: FotoExperiencia) {
    setOcupado(true)
    setAvisos([])
    try {
      setFotos(await eliminarFotoExperiencia(experiencia.id, foto.id))
      setConfirmarId(null)
    } catch (err) {
      setAvisos([`No se pudo eliminar la foto. ${mensajeDeError(err)}`])
    } finally {
      setOcupado(false)
    }
  }

  function terminarArrastre() {
    setArrastrada(null)
    setDestino(null)
  }

  // Se aceptan archivos soltados en cualquier parte del editor (y así el navegador no abre la imagen)
  const zonaArchivos = {
    onDragOver(e: DragEvent) {
      if (!esArrastreDeArchivos(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = libres > 0 ? 'copy' : 'none'
      setSoltandoArchivos(true)
    },
    onDragLeave(e: DragEvent) {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSoltandoArchivos(false)
    },
    onDrop(e: DragEvent) {
      if (!esArrastreDeArchivos(e)) return
      e.preventDefault()
      setSoltandoArchivos(false)
      agregarArchivos([...e.dataTransfer.files])
    },
  }

  return (
    <div {...zonaArchivos}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-campo-700">Galería de fotos</h1>
          <p className="mt-0.5 truncate text-stone-600">{experiencia.titulo}</p>
        </div>
        <p role="status" className="text-sm font-medium text-stone-600">
          {fotos.length + enCurso} de {MAX_FOTOS_EXPERIENCIA} fotos
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-lg sm:p-6">
        <p className="mb-4 text-sm text-stone-600">
          La primera foto es la principal: es la que se ve en el catálogo. Arrastra las fotos o usa las flechas para cambiar el orden.
        </p>

        {avisos.length > 0 && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <ul className="flex-1 space-y-0.5">
              {avisos.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
            <button type="button" onClick={() => setAvisos([])} aria-label="Cerrar aviso" className="rounded p-0.5 hover:bg-red-100">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}

        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fotos.map((foto, i) => (
            <li
              key={foto.id}
              draggable={!bloqueado && confirmarId === null}
              onDragStart={(e) => {
                setArrastrada(i)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(foto.id)) // Firefox no inicia el arrastre sin datos
              }}
              onDragOver={(e) => {
                if (arrastrada === null) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDestino(i)
              }}
              onDrop={(e) => {
                if (arrastrada === null) return
                e.preventDefault()
                mover(arrastrada, i)
                terminarArrastre()
              }}
              onDragEnd={terminarArrastre}
              className={`group relative overflow-hidden rounded-xl bg-white shadow-sm transition ${
                arrastrada === i ? 'opacity-40' : ''
              } ${destino === i && arrastrada !== i ? 'ring-2 ring-campo-500 ring-offset-2' : ''} ${
                bloqueado ? '' : 'cursor-grab active:cursor-grabbing'
              }`}
            >
              <div className="relative aspect-[4/3] bg-stone-100">
              <img
                src={urlArchivo(foto.url) ?? undefined}
                alt={`Foto ${i + 1} de la experiencia`}
                draggable={false}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />

              <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-sm font-semibold text-stone-700 shadow-sm">
                {i === 0 ? (
                  <>
                    <Star className="size-4 fill-amber-400 text-amber-500" aria-hidden />
                    Principal
                  </>
                ) : (
                  i + 1
                )}
              </span>
              {!bloqueado && (
                <GripVertical className="absolute top-2 right-2 size-5 text-white drop-shadow" aria-hidden />
              )}

              </div>

              {/* Botones con texto debajo de la foto: se entienden sin adivinar qué hace cada ícono */}
              <div className="flex flex-wrap gap-2 p-2">
                <BotonFoto
                  etiqueta={`Mover la foto ${i + 1} hacia atrás`}
                  disabled={bloqueado || i === 0}
                  onClick={() => mover(i, i - 1)}
                >
                  <ChevronLeft className="size-5" aria-hidden />
                  Antes
                </BotonFoto>
                <BotonFoto
                  etiqueta={`Mover la foto ${i + 1} hacia adelante`}
                  disabled={bloqueado || i === fotos.length - 1}
                  onClick={() => mover(i, i + 1)}
                >
                  Después
                  <ChevronRight className="size-5" aria-hidden />
                </BotonFoto>
                <BotonFoto etiqueta={`Eliminar la foto ${i + 1}`} disabled={bloqueado} peligro onClick={() => setConfirmarId(foto.id)}>
                  <Trash2 className="size-5" aria-hidden />
                  Eliminar
                </BotonFoto>
              </div>

              {confirmarId === foto.id && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-3 text-center">
                  <p className="text-lg font-semibold text-white">¿Eliminar esta foto?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => eliminar(foto)}
                      disabled={ocupado}
                      className="rounded-lg bg-red-600 px-4 py-2.5 text-base font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {ocupado ? 'Eliminando…' : 'Eliminar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarId(null)}
                      disabled={ocupado}
                      className="rounded-lg bg-white px-4 py-2.5 text-base font-semibold text-stone-800 transition hover:bg-stone-100"
                    >
                      No, dejarla
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}

          {subidas.map((subida) => (
            <li key={`subida-${subida.clave}`} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100 shadow-sm">
              <img src={subida.vista} alt={subida.archivo.name} className="size-full object-cover opacity-60" />
              {subida.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-50/95 p-3 text-center">
                  <TriangleAlert className="size-5 text-red-600" aria-hidden />
                  <p className="line-clamp-3 text-sm text-red-700">{subida.error}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => reintentar(subida)}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
                    >
                      <RotateCw className="size-4" aria-hidden />
                      Reintentar
                    </button>
                    <button
                      type="button"
                      onClick={() => quitarSubida(subida)}
                      className="rounded-lg px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-100"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm font-medium text-stone-700">
                  {subiendo === subida.clave ? (
                    <>
                      <LoaderCircle className="size-6 animate-spin text-campo-600" aria-hidden />
                      Subiendo…
                    </>
                  ) : (
                    'En espera'
                  )}
                </div>
              )}
            </li>
          ))}

          {libres > 0 && (
            <li>
              <label
                htmlFor="fotos-experiencia"
                className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-3 text-center text-sm transition ${
                  soltandoArchivos
                    ? 'border-campo-500 bg-campo-50 text-campo-700'
                    : 'border-stone-500 text-stone-600 hover:border-campo-500 hover:bg-campo-50/50 hover:text-campo-700'
                }`}
              >
                <ImagePlus className="size-7" aria-hidden />
                <span className="font-medium">{soltandoArchivos ? 'Suelta las fotos aquí' : 'Agregar fotos'}</span>
                <span className="text-sm">Examina tu equipo o arrastra las imágenes</span>
              </label>
            </li>
          )}
        </ul>

        <input
          id="fotos-experiencia"
          type="file"
          multiple
          accept={TIPOS_IMAGEN.join(',')}
          onChange={(e) => {
            agregarArchivos([...(e.target.files ?? [])])
            e.target.value = '' // para poder volver a elegir los mismos archivos
          }}
          className="sr-only"
          aria-describedby="fotos-ayuda"
        />
        <p id="fotos-ayuda" className="mt-4 text-sm text-stone-600">
          {libres > 0
            ? `JPG, PNG o WebP, hasta ${MAX_FOTO_EXPERIENCIA_MB} MB cada una. Puedes agregar ${libres} ${libres === 1 ? 'foto más' : 'fotos más'}; se optimizan automáticamente al subirlas.`
            : `Llegaste al máximo de ${MAX_FOTOS_EXPERIENCIA} fotos. Elimina alguna para agregar otra.`}
        </p>
      </div>
    </div>
  )
}

function BotonFoto({
  etiqueta,
  disabled,
  peligro = false,
  onClick,
  children,
}: {
  etiqueta: string
  disabled: boolean
  peligro?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border-2 px-2 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        peligro ? 'border-red-600 text-red-700 hover:bg-red-50' : 'border-stone-500 text-stone-800 hover:bg-stone-100'
      }`}
    >
      {children}
    </button>
  )
}
