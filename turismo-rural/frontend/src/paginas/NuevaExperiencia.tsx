import { ArrowLeft, CircleCheck, LocateFixed, MapPin, Pause, Play } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ErrorApi } from '../api/cliente'
import { misEmprendimientos, type Emprendimiento } from '../api/emprendimientos'
import { mensajeDeError } from '../api/errores'
import { crearExperiencia, type EstadoExperiencia, type TipoExperiencia } from '../api/experiencias'
import CampoArea from '../components/CampoArea'
import CampoTexto from '../components/CampoTexto'
import ErrorCarga from '../components/ErrorCarga'
import SelectorTipo from '../components/SelectorTipo'
import { useCarga } from '../hooks/useCarga'

const MAX_DESCRIPCION = 5000
const SEGUNDOS_REDIRECCION = 2

export default function NuevaExperiencia() {
  const { datos: emprendimientos, error, cargando, recargar } = useCarga(misEmprendimientos, [])

  return (
    <section className="w-full max-w-2xl">
      <Link to="/mis-experiencias" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-campo-600 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Mis experiencias
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-campo-700">Publicar experiencia</h1>

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar tus emprendimientos" onReintentar={recargar} />
      ) : !emprendimientos ? (
        <p className="text-stone-500">Cargando…</p>
      ) : emprendimientos.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-stone-700">Primero necesitas un emprendimiento</p>
          <p className="mt-1 text-sm text-stone-500">Cada experiencia se publica dentro de uno de tus emprendimientos.</p>
          <Link
            to="/mis-emprendimientos"
            className="mt-4 inline-block rounded-lg bg-campo-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-campo-700"
          >
            Crear emprendimiento
          </Link>
        </div>
      ) : (
        <FormularioExperiencia emprendimientos={emprendimientos} />
      )}
    </section>
  )
}

type Campo =
  | 'emprendimiento_id'
  | 'tipo'
  | 'titulo'
  | 'descripcion'
  | 'precio_por_persona'
  | 'capacidad_maxima'
  | 'localidad'
  | 'latitud'
  | 'longitud'
type Errores = Partial<Record<Campo, string>>

type Valores = {
  emprendimiento_id: string
  tipo: TipoExperiencia | null
  titulo: string
  descripcion: string
  precio_por_persona: string
  capacidad_maxima: string
  localidad: string
  latitud: string
  longitud: string
  estado: EstadoExperiencia
}

function validar(v: Valores): Errores {
  const e: Errores = {}
  if (!v.emprendimiento_id) e.emprendimiento_id = 'Elige un emprendimiento'
  if (!v.tipo) e.tipo = 'Elige el tipo de experiencia'

  if (!v.titulo.trim()) e.titulo = 'Ingresa un título'
  else if (v.titulo.trim().length > 150) e.titulo = 'Máximo 150 caracteres'

  if (!v.descripcion.trim()) e.descripcion = 'Describe la experiencia'
  else if (v.descripcion.length > MAX_DESCRIPCION) e.descripcion = `Máximo ${MAX_DESCRIPCION} caracteres`

  const precio = Number(v.precio_por_persona)
  if (v.precio_por_persona.trim() === '') e.precio_por_persona = 'Ingresa el precio (0 si es gratis)'
  else if (!Number.isFinite(precio) || precio < 0) e.precio_por_persona = 'Ingresa un precio válido'
  else if (precio > 99_999_999.99) e.precio_por_persona = 'El precio es demasiado alto'
  else if (!/^\d+(\.\d{1,2})?$/.test(v.precio_por_persona.trim())) {
    e.precio_por_persona = 'Ingresa solo números, con máximo 2 decimales'
  }

  const capacidad = Number(v.capacidad_maxima)
  if (v.capacidad_maxima.trim() === '') e.capacidad_maxima = 'Ingresa la capacidad máxima'
  else if (!Number.isInteger(capacidad) || capacidad < 1) e.capacidad_maxima = 'Debe ser un número entero mayor a 0'
  else if (capacidad > 1000) e.capacidad_maxima = 'Máximo 1000 personas'

  if (!v.localidad.trim()) e.localidad = 'Ingresa la localidad'
  else if (v.localidad.trim().length > 100) e.localidad = 'Máximo 100 caracteres'

  const hayLat = v.latitud.trim() !== ''
  const hayLng = v.longitud.trim() !== ''
  if (hayLat !== hayLng) {
    if (!hayLat) e.latitud = 'Ingresa también la latitud'
    if (!hayLng) e.longitud = 'Ingresa también la longitud'
  }
  if (hayLat && !(Math.abs(Number(v.latitud)) <= 90)) e.latitud = 'La latitud debe estar entre -90 y 90'
  if (hayLng && !(Math.abs(Number(v.longitud)) <= 180)) e.longitud = 'La longitud debe estar entre -180 y 180'
  return e
}

function FormularioExperiencia({ emprendimientos }: { emprendimientos: Emprendimiento[] }) {
  const navigate = useNavigate()
  const [valores, setValores] = useState<Valores>({
    emprendimiento_id: String(emprendimientos[0].id),
    tipo: null,
    titulo: '',
    descripcion: '',
    precio_por_persona: '',
    capacidad_maxima: '',
    localidad: emprendimientos[0].localidad,
    latitud: '',
    longitud: '',
    estado: 'activo',
  })
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({})
  const [erroresServidor, setErroresServidor] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)
  const [ubicando, setUbicando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [publicada, setPublicada] = useState<{ id: number; titulo: string } | null>(null)

  // Tras publicar: confirmación breve y redirección a "Mis experiencias"
  useEffect(() => {
    if (!publicada) return
    const t = setTimeout(
      () => navigate('/mis-experiencias', { state: { nueva: publicada.id } }),
      SEGUNDOS_REDIRECCION * 1000,
    )
    return () => clearTimeout(t)
  }, [publicada, navigate])

  const errores = validar(valores)
  const errorDe = (c: Campo) => erroresServidor[c] ?? (tocados[c] ? errores[c] : undefined)
  const tocar = (c: Campo) => setTocados((t) => ({ ...t, [c]: true }))

  function cambiar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setValores((v) => ({ ...v, [campo]: valor }))
    setErroresServidor((e) => ({ ...e, [campo]: undefined }))
    setErrorGeneral(null)
  }

  function usarMiUbicacion() {
    if (!('geolocation' in navigator)) {
      setErrorUbicacion('Tu navegador no permite obtener la ubicación.')
      return
    }
    setUbicando(true)
    setErrorUbicacion(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        cambiar('latitud', coords.latitude.toFixed(6))
        cambiar('longitud', coords.longitude.toFixed(6))
        setUbicando(false)
      },
      (err) => {
        setErrorUbicacion(
          err.code === err.PERMISSION_DENIED
            ? 'No diste permiso para acceder a tu ubicación. Puedes ingresar las coordenadas a mano.'
            : 'No pudimos obtener tu ubicación. Inténtalo de nuevo o ingresa las coordenadas a mano.',
        )
        setUbicando(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTocados(Object.fromEntries(Object.keys(valores).map((k) => [k, true])))
    if (Object.keys(errores).length > 0) {
      setErrorGeneral('Revisa los campos marcados en rojo.')
      return
    }

    setEnviando(true)
    setErrorGeneral(null)
    try {
      const hayCoordenadas = valores.latitud.trim() !== ''
      const creada = await crearExperiencia({
        emprendimiento_id: Number(valores.emprendimiento_id),
        tipo: valores.tipo!,
        titulo: valores.titulo.trim(),
        descripcion: valores.descripcion.trim(),
        precio_por_persona: Number(valores.precio_por_persona),
        capacidad_maxima: Number(valores.capacidad_maxima),
        localidad: valores.localidad.trim(),
        latitud: hayCoordenadas ? Number(valores.latitud) : null,
        longitud: hayCoordenadas ? Number(valores.longitud) : null,
        estado: valores.estado,
      })
      setPublicada({ id: creada.id, titulo: creada.titulo })
    } catch (err) {
      const campo = err instanceof ErrorApi ? err.campo : null
      if (campo && campo in valores) setErroresServidor({ [campo]: mensajeDeError(err) })
      else setErrorGeneral(mensajeDeError(err))
      setEnviando(false)
    }
  }

  if (publicada) {
    return (
      <div role="status" className="flex flex-col items-center rounded-2xl bg-white p-10 text-center shadow-lg">
        <CircleCheck className="mb-3 size-14 text-campo-600" aria-hidden />
        <h2 className="text-2xl font-bold text-campo-700">¡Experiencia publicada!</h2>
        <p className="mt-2 text-stone-600">
          <span className="font-medium">{publicada.titulo}</span>{' '}
          {valores.estado === 'activo' ? 'ya aparece en el catálogo.' : 'quedó guardada como pausada.'}
        </p>
        <p className="mt-4 text-sm text-stone-500">Te llevamos a Mis experiencias…</p>
        <Link
          to="/mis-experiencias"
          state={{ nueva: publicada.id }}
          className="mt-3 text-sm font-medium text-campo-600 hover:underline"
        >
          Ir ahora
        </Link>
      </div>
    )
  }

  const lat = Number(valores.latitud)
  const lng = Number(valores.longitud)
  const coordenadasValidas = valores.latitud.trim() && valores.longitud.trim() && !errores.latitud && !errores.longitud

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 rounded-2xl bg-white p-6 shadow-lg sm:p-8">
      {emprendimientos.length > 1 && (
        <div>
          <label htmlFor="exp-emprendimiento" className="mb-1 block text-sm font-medium text-stone-700">
            Emprendimiento
          </label>
          <select
            id="exp-emprendimiento"
            value={valores.emprendimiento_id}
            onChange={(e) => cambiar('emprendimiento_id', e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 outline-none focus:border-campo-500 focus:ring-2 focus:ring-campo-100"
          >
            {emprendimientos.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nombre}
              </option>
            ))}
          </select>
          {errorDe('emprendimiento_id') && <p className="mt-1 text-sm text-red-600">{errorDe('emprendimiento_id')}</p>}
        </div>
      )}

      <SelectorTipo valor={valores.tipo} error={errorDe('tipo')} onChange={(t) => cambiar('tipo', t)} />

      <CampoTexto
        id="exp-titulo"
        label="Título"
        type="text"
        maxLength={150}
        placeholder="Cabalgata al atardecer por el valle"
        value={valores.titulo}
        error={errorDe('titulo')}
        onChange={(v) => cambiar('titulo', v)}
        onBlur={() => tocar('titulo')}
      />

      <CampoArea
        id="exp-descripcion"
        label="Descripción"
        maxLength={MAX_DESCRIPCION}
        filas={5}
        placeholder="¿Qué incluye? ¿Cuánto dura? ¿Qué deben llevar los visitantes?"
        value={valores.descripcion}
        error={errorDe('descripcion')}
        onChange={(v) => cambiar('descripcion', v)}
        onBlur={() => tocar('descripcion')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          id="exp-precio"
          label="Precio por persona"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          prefijo="$"
          placeholder="25000"
          ayuda="Sin puntos. Usa 0 si es gratis."
          value={valores.precio_por_persona}
          error={errorDe('precio_por_persona')}
          onChange={(v) => cambiar('precio_por_persona', v)}
          onBlur={() => tocar('precio_por_persona')}
        />
        <CampoTexto
          id="exp-capacidad"
          label="Capacidad máxima"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          step={1}
          placeholder="10"
          ayuda="Personas por salida o sesión."
          value={valores.capacidad_maxima}
          error={errorDe('capacidad_maxima')}
          onChange={(v) => cambiar('capacidad_maxima', v)}
          onBlur={() => tocar('capacidad_maxima')}
        />
      </div>

      <CampoTexto
        id="exp-localidad"
        label="Localidad"
        type="text"
        maxLength={100}
        placeholder="Pucón"
        value={valores.localidad}
        error={errorDe('localidad')}
        onChange={(v) => cambiar('localidad', v)}
        onBlur={() => tocar('localidad')}
      />

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-stone-700">
          Coordenadas <span className="font-normal text-stone-400">(opcional)</span>
        </legend>
        <p className="mb-3 text-xs text-stone-500">Ayudan a los visitantes a encontrar el punto de encuentro.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            id="exp-latitud"
            label="Latitud"
            type="number"
            inputMode="decimal"
            step="any"
            min={-90}
            max={90}
            placeholder="-39.2726"
            value={valores.latitud}
            error={errorDe('latitud')}
            onChange={(v) => cambiar('latitud', v)}
            onBlur={() => tocar('latitud')}
          />
          <CampoTexto
            id="exp-longitud"
            label="Longitud"
            type="number"
            inputMode="decimal"
            step="any"
            min={-180}
            max={180}
            placeholder="-71.9773"
            value={valores.longitud}
            error={errorDe('longitud')}
            onChange={(v) => cambiar('longitud', v)}
            onBlur={() => tocar('longitud')}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={usarMiUbicacion}
            disabled={ubicando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
          >
            <LocateFixed className="size-4" aria-hidden />
            {ubicando ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
          </button>
          {coordenadasValidas && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-campo-600 hover:underline"
            >
              <MapPin className="size-4" aria-hidden />
              Ver en el mapa
            </a>
          )}
        </div>
        {errorUbicacion && <p className="mt-2 text-sm text-amber-700">{errorUbicacion}</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-stone-700">Estado</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['activo', 'Activa', 'Visible en el catálogo', Play],
              ['pausado', 'Pausada', 'Oculta hasta que la actives', Pause],
            ] as const
          ).map(([id, nombre, detalle, Icono]) => (
            <label
              key={id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-campo-500 ${
                valores.estado === id ? 'border-campo-500 bg-campo-50' : 'border-stone-200 hover:border-campo-500'
              }`}
            >
              <input
                type="radio"
                name="estado"
                value={id}
                checked={valores.estado === id}
                onChange={() => cambiar('estado', id)}
                className="sr-only"
              />
              <Icono className={`size-5 ${valores.estado === id ? 'text-campo-600' : 'text-stone-400'}`} aria-hidden />
              <span>
                <span className="block text-sm font-medium text-stone-800">{nombre}</span>
                <span className="block text-xs text-stone-500">{detalle}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {errorGeneral && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorGeneral}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-campo-600 py-3 font-medium text-white shadow transition hover:bg-campo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? 'Publicando…' : 'Publicar'}
      </button>
    </form>
  )
}
