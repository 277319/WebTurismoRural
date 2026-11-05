import { ArrowLeft, CalendarCheck, CalendarX, CircleCheck, LoaderCircle, Undo2, X } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { DayButton, DayPicker, type DayButtonProps } from 'react-day-picker'
import { es } from 'react-day-picker/locale/es'
import 'react-day-picker/style.css'
import { Link, useParams } from 'react-router'
import { ErrorApi } from '../api/cliente'
import { mensajeDeError } from '../api/errores'
import {
  guardarDisponibilidad,
  MAX_DIAS_DISPONIBILIDAD,
  misExperiencias,
  obtenerDisponibilidad,
  type DiaDisponible,
  type Experiencia,
} from '../api/experiencias'
import ErrorCarga from '../components/ErrorCarga'
import { aIso, desdeIso, formatoDia, hoyLocal, sumarDias } from '../fechas'
import { useCarga } from '../hooks/useCarga'
import { esHospedaje } from '../tiposExperiencia'

export default function DisponibilidadExperiencia() {
  const { id } = useParams()
  const experienciaId = Number(id)
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const [experiencias, dias] = await Promise.all([misExperiencias(), obtenerDisponibilidad(experienciaId)])
    const experiencia = experiencias.find((e) => e.id === experienciaId)
    if (!experiencia) throw new ErrorApi('No encontramos esta experiencia entre las tuyas.', null, 404)
    return { experiencia, dias }
  }, [experienciaId])

  return (
    <section className="w-full max-w-4xl">
      <Link to="/mis-experiencias" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-campo-600 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Mis experiencias
      </Link>

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar la disponibilidad" onReintentar={recargar} />
      ) : !datos ? (
        <p className="text-stone-600">Cargando…</p>
      ) : (
        <EditorDisponibilidad key={datos.experiencia.id} experiencia={datos.experiencia} diasIniciales={datos.dias} />
      )}
    </section>
  )
}

const formatoMes = new Intl.DateTimeFormat('es-CL', { month: 'long' })

const consultaEscritorio = window.matchMedia('(min-width: 768px)')

/** En pantallas anchas se muestran dos meses a la vez */
function useEsEscritorio() {
  return useSyncExternalStore(
    (avisar) => {
      consultaEscritorio.addEventListener('change', avisar)
      return () => consultaEscritorio.removeEventListener('change', avisar)
    },
    () => consultaEscritorio.matches,
  )
}

/** Cupos por día marcado, para que cada celda del calendario muestre los suyos */
const CuposPorDia = createContext<Map<string, number>>(new Map())

function BotonDia({ day, modifiers, children, ...props }: DayButtonProps) {
  const cupos = useContext(CuposPorDia).get(day.isoDate)
  const marcado = cupos !== undefined && !day.outside
  return (
    <DayButton
      day={day}
      modifiers={modifiers}
      {...props}
      aria-label={
        marcado && !Number.isNaN(cupos) ? `${props['aria-label']}, ${cupos} ${cupos === 1 ? 'cupo' : 'cupos'}` : props['aria-label']
      }
    >
      <span>{children}</span>
      {marcado && <span className="text-xs leading-none font-normal opacity-90">{Number.isNaN(cupos) ? '–' : cupos}</span>}
    </DayButton>
  )
}

/** 0 es válido: el día sigue abierto pero completo */
const cuposValidos = (cupos: number, maximo: number) => Number.isInteger(cupos) && cupos >= 0 && cupos <= maximo

function mismosDias(a: Map<string, number>, b: Map<string, number>) {
  if (a.size !== b.size) return false
  for (const [fecha, cupos] of a) if (b.get(fecha) !== cupos) return false
  return true
}

function EditorDisponibilidad({ experiencia, diasIniciales }: { experiencia: Experiencia; diasIniciales: DiaDisponible[] }) {
  const capacidad = experiencia.capacidad_maxima
  const [hoy] = useState(hoyLocal)
  const limite = useMemo(() => sumarDias(hoy, MAX_DIAS_DISPONIBILIDAD), [hoy])
  const esEscritorio = useEsEscritorio()
  const meses = esEscritorio ? 2 : 1

  const [guardados, setGuardados] = useState(() => new Map(diasIniciales.map((d) => [d.fecha, d.cupos])))
  const [dias, setDias] = useState(guardados)
  // Personas con reserva activa por día: no se pueden cerrar y limitan los cupos libres
  const [reservados, setReservados] = useState(() => new Map(diasIniciales.map((d) => [d.fecha, d.reservados])))
  const [mes, setMes] = useState(hoy)
  const [textoCupos, setTextoCupos] = useState(String(capacidad))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardadoOk, setGuardadoOk] = useState(false)

  const cuposNuevos = Number(textoCupos)
  const cuposNuevosValidos = textoCupos.trim() !== '' && cuposNuevos >= 1 && cuposValidos(cuposNuevos, capacidad)
  const hayCambios = !mismosDias(dias, guardados)
  /** Cupos libres que admite el día: la capacidad menos las personas ya reservadas */
  const maximo = (fecha: string) => Math.max(capacidad - (reservados.get(fecha) ?? 0), 0)
  const hayInvalidos = [...dias].some(([fecha, cupos]) => !cuposValidos(cupos, maximo(fecha)))

  // Avisa antes de cerrar o recargar la pestaña con cambios sin guardar
  useEffect(() => {
    if (!hayCambios) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])

  const seleccionados = useMemo(() => [...dias.keys()].map(desdeIso), [dias])

  // Días de los meses que se están viendo y que se pueden abrir (entre hoy y el límite)
  const diasVisibles = useMemo(() => {
    const resultado: string[] = []
    const fin = new Date(mes.getFullYear(), mes.getMonth() + meses, 1)
    for (let d = new Date(mes.getFullYear(), mes.getMonth(), 1); d < fin; d = sumarDias(d, 1)) {
      if (d >= hoy && d <= limite) resultado.push(aIso(d))
    }
    return resultado
  }, [mes, meses, hoy, limite])
  const marcadosVisibles = diasVisibles.filter((fecha) => dias.has(fecha))
  const cerrablesVisibles = marcadosVisibles.filter((fecha) => !reservados.get(fecha))

  const nombreMeses = Array.from({ length: meses }, (_, i) =>
    formatoMes.format(new Date(mes.getFullYear(), mes.getMonth() + i, 1)),
  ).join(' y ')

  function cambiar(actualizar: (siguiente: Map<string, number>) => void) {
    setDias((actual) => {
      const siguiente = new Map(actual)
      actualizar(siguiente)
      return siguiente
    })
    setGuardadoOk(false)
    setError(null)
  }

  function alternar(fecha: Date) {
    const iso = aIso(fecha)
    const conReservas = reservados.get(iso) ?? 0
    if (dias.has(iso) && conReservas > 0) {
      setError(`El ${formatoDia.format(fecha)} tiene ${conReservas} ${conReservas === 1 ? 'persona reservada' : 'personas reservadas'}: no se puede cerrar.`)
      return
    }
    if (!dias.has(iso) && !cuposNuevosValidos) {
      setError(`Indica entre 1 y ${capacidad} cupos antes de marcar días.`)
      return
    }
    cambiar((d) => (d.has(iso) ? d.delete(iso) : d.set(iso, Math.min(cuposNuevos, maximo(iso)))))
  }

  function marcarVisibles() {
    if (!cuposNuevosValidos) {
      setError(`Indica entre 1 y ${capacidad} cupos antes de marcar días.`)
      return
    }
    // Los días ya marcados conservan sus cupos
    cambiar((d) => diasVisibles.forEach((fecha) => d.has(fecha) || d.set(fecha, Math.min(cuposNuevos, maximo(fecha)))))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const enviados = [...dias].map(([fecha, cupos]) => ({ fecha, cupos })).sort((a, b) => a.fecha.localeCompare(b.fecha))
      const respuesta = await guardarDisponibilidad(experiencia.id, enviados)
      const nuevos = new Map(respuesta.map((d) => [d.fecha, d.cupos]))
      setGuardados(nuevos)
      setDias(nuevos)
      setReservados(new Map(respuesta.map((d) => [d.fecha, d.reservados])))
      setGuardadoOk(true)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  const botonSecundario =
    'inline-flex items-center gap-1.5 rounded-lg border-2 border-stone-500 bg-white px-4 py-2.5 text-base font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div className="pb-24">
      <div className="mb-6 min-w-0">
        <h1 className="text-3xl font-bold text-campo-700">Disponibilidad</h1>
        <p className="mt-0.5 truncate text-stone-600">{experiencia.titulo}</p>
        {experiencia.estado === 'pausado' && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Esta experiencia está pausada: los visitantes no verán estas fechas hasta que la reanudes.
          </p>
        )}
        {esHospedaje(experiencia.tipo) && (
          <p className="mt-2 text-sm text-stone-600">
            Cada día marcado es una noche en que recibes huéspedes. Una estadía ocupa cupos en cada una de sus noches,
            pero no el día de salida.
          </p>
        )}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm text-stone-600">
          Toca un día para abrirlo y vuelve a tocarlo para cerrarlo. Puedes abrir fechas hasta un año hacia adelante.
          Los cupos son los lugares libres: cuando un visitante reserva, se descuentan solos.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-base font-semibold text-stone-800">
            Cupos para los días que marques
            <span className="mt-1 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={capacidad}
                value={textoCupos}
                onChange={(e) => {
                  setTextoCupos(e.target.value)
                  setError(null)
                }}
                aria-invalid={!cuposNuevosValidos}
                aria-describedby="ayuda-cupos"
                className={`w-24 rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                  cuposNuevosValidos
                    ? 'border-stone-500 focus:border-campo-500 focus:ring-campo-100'
                    : 'border-red-400 focus:border-red-500 focus:ring-red-100'
                }`}
              />
              <span id="ayuda-cupos" className="font-normal text-stone-600">
                de {capacidad} (capacidad máxima)
              </span>
            </span>
          </label>
        </div>

        <CuposPorDia value={dias}>
          <DayPicker
            mode="multiple"
            locale={es}
            className="calendario mt-4"
            numberOfMonths={meses}
            month={mes}
            onMonthChange={setMes}
            startMonth={hoy}
            endMonth={limite}
            disabled={[{ before: hoy }, { after: limite }]}
            selected={seleccionados}
            onSelect={(_, dia) => alternar(dia)}
            components={{ DayButton: BotonDia }}
          />
        </CuposPorDia>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={marcarVisibles} disabled={marcadosVisibles.length === diasVisibles.length} className={botonSecundario}>
            <CalendarCheck className="size-4" aria-hidden />
            Abrir todo {nombreMeses}
          </button>
          <button
            type="button"
            onClick={() => cambiar((d) => cerrablesVisibles.forEach((fecha) => d.delete(fecha)))}
            disabled={cerrablesVisibles.length === 0}
            title="Los días con reservas se mantienen abiertos"
            className={botonSecundario}
          >
            <CalendarX className="size-4" aria-hidden />
            Cerrar todo {nombreMeses}
          </button>
          {marcadosVisibles.length > 0 && cuposNuevosValidos && (
            <button
              type="button"
              onClick={() => cambiar((d) => marcadosVisibles.forEach((fecha) => d.set(fecha, Math.min(cuposNuevos, maximo(fecha)))))}
              disabled={marcadosVisibles.every((fecha) => dias.get(fecha) === Math.min(cuposNuevos, maximo(fecha)))}
              className={botonSecundario}
            >
              Poner {cuposNuevos} {cuposNuevos === 1 ? 'cupo' : 'cupos'} a los días abiertos de {nombreMeses}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="font-semibold text-stone-800">
          Días abiertos en {nombreMeses}
          <span className="ml-2 text-sm font-normal text-stone-600">({marcadosVisibles.length})</span>
        </h2>
        {marcadosVisibles.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">Aún no hay días abiertos en {meses === 1 ? 'este mes' : 'estos meses'}.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {marcadosVisibles.map((fecha) => {
              const cupos = dias.get(fecha)!
              const conReservas = reservados.get(fecha) ?? 0
              const valido = cuposValidos(cupos, maximo(fecha))
              const etiqueta = formatoDia.format(desdeIso(fecha))
              return (
                <li key={fecha} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block text-stone-700 capitalize">{etiqueta}</span>
                    {conReservas > 0 && (
                      <span className="block text-sm text-tierra-500">
                        {conReservas} {conReservas === 1 ? 'reservada' : 'reservadas'} · máx. {maximo(fecha)} libres
                      </span>
                    )}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={maximo(fecha)}
                    value={Number.isNaN(cupos) ? '' : cupos}
                    onChange={(e) => {
                      const valor = e.target.value === '' ? NaN : Number(e.target.value)
                      cambiar((d) => d.set(fecha, valor))
                    }}
                    aria-label={`Cupos libres del ${etiqueta}`}
                    aria-invalid={!valido}
                    className={`w-16 rounded-md border px-2 py-1 text-sm focus:ring-2 focus:outline-none ${
                      valido ? 'border-stone-500 focus:border-campo-500 focus:ring-campo-100' : 'border-red-400 focus:ring-red-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => cambiar((d) => d.delete(fecha))}
                    disabled={conReservas > 0}
                    aria-label={`Cerrar el ${etiqueta}`}
                    title={conReservas > 0 ? 'Tiene reservas: no se puede cerrar' : undefined}
                    className="rounded-md p-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Barra fija con el resumen y el botón de guardar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          <div role="status" className="min-w-0 flex-1 text-sm">
            {error ? (
              <span className="text-red-600">{error}</span>
            ) : hayInvalidos ? (
              <span className="text-red-600">
                Revisa los cupos en rojo: cada día admite hasta {capacidad} menos las personas ya reservadas.
              </span>
            ) : hayCambios ? (
              <span className="font-medium text-amber-700">Tienes cambios sin guardar · {dias.size} días abiertos</span>
            ) : guardadoOk ? (
              <span className="inline-flex items-center gap-1 font-medium text-campo-700">
                <CircleCheck className="size-4" aria-hidden />
                Disponibilidad guardada · {dias.size} días abiertos
              </span>
            ) : (
              <span className="text-stone-600">
                {dias.size === 0 ? 'Sin días abiertos' : `${dias.size} ${dias.size === 1 ? 'día abierto' : 'días abiertos'}`}
              </span>
            )}
          </div>
          {hayCambios && (
            <button
              type="button"
              onClick={() => {
                setDias(guardados)
                setError(null)
              }}
              disabled={guardando}
              className={botonSecundario}
            >
              <Undo2 className="size-4" aria-hidden />
              Descartar
            </button>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={!hayCambios || hayInvalidos || guardando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-campo-600 px-5 py-2.5 text-base font-semibold text-white shadow transition hover:bg-campo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
