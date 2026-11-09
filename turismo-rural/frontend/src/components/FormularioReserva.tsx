import {
  Banknote,
  CalendarX,
  CircleCheck,
  CreditCard,
  HandCoins,
  Landmark,
  LoaderCircle,
  Minus,
  Plus,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale/es'
import 'react-day-picker/style.css'
import { Link, useLocation } from 'react-router'
import { ErrorApi } from '../api/cliente'
import { mensajeDeError } from '../api/errores'
import { formatearPrecio, obtenerDisponibilidad, type ExperienciaDetalle } from '../api/experiencias'
import {
  crearReserva,
  esEstadia,
  MAX_NOCHES,
  METODOS_PAGO,
  NOMBRE_ESTADO_RESERVA,
  type MetodoPago,
  type Reserva,
} from '../api/reservas'
import { useAuth } from '../auth/contexto'
import { aIso, desdeIso, formatoDia, formatoFechaLarga, hoyLocal, sumarDias } from '../fechas'
import { useCarga } from '../hooks/useCarga'
import { esHospedaje } from '../tiposExperiencia'
import { CORREO_RE } from '../validacion'
import CampoTexto from './CampoTexto'

/** Opciones principales; "al llegar" se completa eligiendo efectivo o tarjeta */
type OpcionPago = 'en_linea' | 'al_llegar' | 'transferencia'
type MedioAlLlegar = Extract<MetodoPago, 'efectivo' | 'tarjeta'>

const OPCIONES_PAGO: { id: OpcionPago; nombre: string; descripcion: string; Icono: LucideIcon }[] = [
  { id: 'en_linea', ...METODOS_PAGO.en_linea, Icono: Smartphone },
  { id: 'al_llegar', nombre: 'Pago al llegar', descripcion: 'Pagas en el lugar, en efectivo o con tarjeta', Icono: HandCoins },
  { id: 'transferencia', ...METODOS_PAGO.transferencia, Icono: Landmark },
]

const MEDIOS_AL_LLEGAR: { id: MedioAlLlegar; nombre: string; Icono: LucideIcon }[] = [
  { id: 'efectivo', nombre: 'Efectivo', Icono: Banknote },
  { id: 'tarjeta', nombre: 'Tarjeta', Icono: CreditCard },
]

type ErrorFormulario = { campo: string | null; mensaje: string }

const plural = (n: number, singular: string, varios: string) => `${n} ${n === 1 ? singular : varios}`

/**
 * Formulario de reserva: solo deja elegir fechas con cupos y muestra el total antes de reservar.
 * En un hospedaje se elige el día de llegada y cuántas noches, y todas tienen que tener cupos.
 */
export default function FormularioReserva({ experiencia: exp }: { experiencia: ExperienciaDetalle }) {
  const { usuario } = useAuth()
  const location = useLocation()
  const { datos: dias, error: errorCarga, cargando, recargar } = useCarga(() => obtenerDisponibilidad(exp.id), [exp.id])
  const [hoy] = useState(hoyLocal)

  const [fecha, setFecha] = useState<string | null>(null)
  const [noches, setNoches] = useState(1)
  const [personas, setPersonas] = useState(1)
  const [opcionPago, setOpcionPago] = useState<OpcionPago | null>(null)
  const [medioAlLlegar, setMedioAlLlegar] = useState<MedioAlLlegar | null>(null)
  // Se propone el de la cuenta; las cuentas registradas solo con teléfono tienen que escribir uno
  const [correo, setCorreo] = useState(usuario?.correo ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<ErrorFormulario | null>(null)
  const [reserva, setReserva] = useState<Reserva | null>(null)

  const gratuita = exp.precio_por_persona === 0
  const hospedaje = esHospedaje(exp.tipo)
  // Solo las fechas con al menos un cupo libre se pueden elegir
  const cuposPorFecha = useMemo(
    () => new Map((dias ?? []).filter((d) => d.cupos > 0 && desdeIso(d.fecha) >= hoy).map((d) => [d.fecha, d.cupos])),
    [dias, hoy],
  )
  const fechasDisponibles = [...cuposPorFecha.keys()].sort()
  // Si la fecha elegida se agotó al recargar, deja de estar elegida
  const fechaValida = fecha && cuposPorFecha.has(fecha) ? fecha : null
  // La estadía puede alargarse mientras las noches siguientes a la llegada tengan cupos
  const maxNoches = useMemo(() => {
    if (!hospedaje || !fechaValida) return 1
    let n = 1
    while (n < MAX_NOCHES && cuposPorFecha.has(aIso(sumarDias(desdeIso(fechaValida), n)))) n++
    return n
  }, [hospedaje, fechaValida, cuposPorFecha])
  const nochesValidas = Math.min(noches, maxNoches)
  const nochesEstadia = fechaValida ? Array.from({ length: nochesValidas }, (_, i) => sumarDias(desdeIso(fechaValida), i)) : []
  const salida = fechaValida ? sumarDias(desdeIso(fechaValida), nochesValidas) : null
  // Cupos libres en todas las noches elegidas (en las experiencias de un día, los de esa fecha)
  const cuposFecha = fechaValida ? Math.min(...nochesEstadia.map((d) => cuposPorFecha.get(aIso(d))!)) : null
  const maxPersonas = Math.min(exp.capacidad_maxima, cuposFecha ?? exp.capacidad_maxima)
  const personasValidas = Math.min(personas, maxPersonas)
  const total = exp.precio_por_persona * personasValidas * nochesValidas
  // Lo que se guarda: al llegar, el medio elegido (efectivo o tarjeta), para que el anfitrión lo sepa
  const metodo: MetodoPago | null = opcionPago === 'al_llegar' ? medioAlLlegar : opcionPago

  function elegirFecha(dia: Date) {
    setFecha(aIso(dia))
    setError(null)
  }

  async function reservar(e: FormEvent) {
    e.preventDefault()
    if (!fechaValida) return setError({ campo: 'fecha', mensaje: 'Elige una fecha disponible' })
    if (!gratuita && !metodo) {
      return setError({
        campo: 'metodo_pago',
        mensaje: opcionPago === 'al_llegar' ? 'Elige si pagarás en efectivo o con tarjeta' : 'Elige cómo vas a pagar',
      })
    }
    if (!correo.trim()) return setError({ campo: 'correo', mensaje: 'Ingresa tu correo para recibir los avisos de tu reserva' })
    if (!CORREO_RE.test(correo.trim())) return setError({ campo: 'correo', mensaje: 'El correo no es válido' })

    setEnviando(true)
    setError(null)
    try {
      const nueva = await crearReserva({
        experiencia_id: exp.id,
        fecha: fechaValida,
        noches: nochesValidas,
        personas: personasValidas,
        metodo_pago: gratuita ? null : metodo,
        correo: correo.trim(),
      })
      setReserva(nueva)
      recargar()
    } catch (err) {
      setError({ campo: err instanceof ErrorApi ? err.campo : null, mensaje: mensajeDeError(err) })
      // Otra persona pudo reservar mientras tanto: se muestran los cupos actualizados
      if (err instanceof ErrorApi && err.status === 409) recargar()
    } finally {
      setEnviando(false)
    }
  }

  if (reserva) {
    return (
      <ConfirmacionReserva
        reserva={reserva}
        onOtra={() => {
          setReserva(null)
          setFecha(null)
          setNoches(1)
          setPersonas(1)
        }}
      />
    )
  }

  if (errorCarga && !cargando) {
    return (
      <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
        No pudimos cargar las fechas disponibles.{' '}
        <button type="button" onClick={recargar} className="font-medium underline">
          Intentar de nuevo
        </button>
      </div>
    )
  }
  if (!dias) return <p className="text-sm text-stone-600">Cargando fechas…</p>

  if (fechasDisponibles.length === 0) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-stone-100 px-3 py-2.5 text-sm text-stone-600">
        <CalendarX className="mt-0.5 size-4 shrink-0" aria-hidden />
        No hay fechas disponibles por ahora. Consulta al anfitrión por próximas {hospedaje ? 'fechas' : 'salidas'}.
      </p>
    )
  }

  const errorDe = (campo: string) => (error?.campo === campo ? error.mensaje : null)
  const errorGeneral = error && !['fecha', 'noches', 'personas', 'metodo_pago', 'correo'].includes(error.campo ?? '') ? error.mensaje : null

  return (
    <form onSubmit={reservar} noValidate className="space-y-5">
      <fieldset>
        <legend className="text-lg font-bold text-stone-800">
          1. {hospedaje ? 'Elige el día de llegada' : 'Elige la fecha'}
        </legend>
        <DayPicker
          mode="single"
          required
          locale={es}
          className="calendario compacto mt-2"
          selected={fechaValida ? desdeIso(fechaValida) : undefined}
          onSelect={elegirFecha}
          defaultMonth={desdeIso(fechasDisponibles[0])}
          startMonth={desdeIso(fechasDisponibles[0])}
          endMonth={desdeIso(fechasDisponibles[fechasDisponibles.length - 1])}
          disabled={(dia) => !cuposPorFecha.has(aIso(dia))}
          // En un hospedaje se resaltan las demás noches de la estadía y el día de salida
          modifiers={hospedaje && salida ? { estadia: nochesEstadia.slice(1), salida } : undefined}
          modifiersClassNames={{ estadia: 'estadia', salida: 'salida' }}
        />
        <p className={`mt-1 text-sm ${errorDe('fecha') ? 'text-red-600' : 'text-stone-600'}`} role={errorDe('fecha') ? 'alert' : undefined}>
          {errorDe('fecha') ??
            (fechaValida
              ? hospedaje
                ? `Llegada el ${formatoFechaLarga.format(desdeIso(fechaValida))}`
                : `${formatoFechaLarga.format(desdeIso(fechaValida))} · ${cuposFecha === 1 ? 'queda 1 cupo' : `quedan ${cuposFecha} cupos`}`
              : 'Solo puedes elegir los días resaltados.')}
        </p>
      </fieldset>

      {hospedaje && (
        <fieldset>
          <legend className="text-lg font-bold text-stone-800">2. ¿Cuántas noches?</legend>
          <Contador
            valor={nochesValidas}
            maximo={maxNoches}
            texto={plural(nochesValidas, 'noche', 'noches')}
            etiquetaMenos="Una noche menos"
            etiquetaMas="Una noche más"
            onChange={(n) => {
              setNoches(n)
              if (error?.campo === 'noches' || error?.campo === 'fecha') setError(null)
            }}
          />
          <p className={`mt-1 text-sm ${errorDe('noches') ? 'text-red-600' : 'text-stone-600'}`}>
            {errorDe('noches') ??
              (salida
                ? `Salida el ${formatoDia.format(salida)} · ${cuposFecha === 1 ? 'queda 1 cupo' : `quedan ${cuposFecha} cupos`}${
                    nochesValidas >= maxNoches && maxNoches < MAX_NOCHES ? '. La noche siguiente no está disponible' : ''
                  }`
                : 'Elige primero el día de llegada.')}
          </p>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-lg font-bold text-stone-800">{hospedaje ? 3 : 2}. ¿Cuántas personas?</legend>
        <Contador
          valor={personasValidas}
          maximo={maxPersonas}
          texto={plural(personasValidas, 'persona', 'personas')}
          etiquetaMenos="Una persona menos"
          etiquetaMas="Una persona más"
          onChange={(n) => {
            setPersonas(n)
            if (error?.campo === 'personas') setError(null)
          }}
        />
        <p className={`mt-1 text-sm ${errorDe('personas') ? 'text-red-600' : 'text-stone-600'}`}>
          {errorDe('personas') ??
            (cuposFecha !== null && cuposFecha < exp.capacidad_maxima
              ? `Máximo ${maxPersonas} para ${nochesValidas > 1 ? 'esas noches' : 'esta fecha'}`
              : `Máximo ${exp.capacidad_maxima} por ${hospedaje ? 'noche' : 'salida'}`)}
        </p>
      </fieldset>

      {!gratuita && (
        <fieldset>
          <legend className="text-lg font-bold text-stone-800">{hospedaje ? 4 : 3}. ¿Cómo vas a pagar?</legend>
          <div className="mt-2 space-y-2">
            {OPCIONES_PAGO.map(({ id, nombre, descripcion, Icono }) => {
              const elegida = opcionPago === id
              return (
                <div
                  key={id}
                  className={`rounded-lg border transition ${
                    elegida ? 'border-campo-500 bg-campo-50 ring-1 ring-campo-500' : 'border-stone-400 hover:bg-stone-50'
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                    <input
                      type="radio"
                      name="opcion_pago"
                      value={id}
                      checked={elegida}
                      onChange={() => {
                        setOpcionPago(id)
                        if (error?.campo === 'metodo_pago') setError(null)
                      }}
                      className="sr-only"
                    />
                    <Icono className={`size-5 shrink-0 ${elegida ? 'text-campo-600' : 'text-stone-500'}`} aria-hidden />
                    <span className="text-sm">
                      <span className="block font-medium text-stone-800">{nombre}</span>
                      <span className="block text-stone-600">{descripcion}</span>
                    </span>
                  </label>
                  {id === 'al_llegar' && elegida && (
                    <div role="radiogroup" aria-label="Medio de pago al llegar" className="flex gap-2 px-3 pb-3 pl-11">
                      {MEDIOS_AL_LLEGAR.map((medio) => {
                        const activo = medioAlLlegar === medio.id
                        return (
                          <label
                            key={medio.id}
                            className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border bg-white px-4 py-2.5 text-base font-semibold transition ${
                              activo ? 'border-campo-500 text-campo-700 ring-1 ring-campo-500' : 'border-stone-500 text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="medio_al_llegar"
                              value={medio.id}
                              checked={activo}
                              onChange={() => {
                                setMedioAlLlegar(medio.id)
                                if (error?.campo === 'metodo_pago') setError(null)
                              }}
                              className="sr-only"
                            />
                            <medio.Icono className="size-4" aria-hidden />
                            {medio.nombre}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {errorDe('metodo_pago') && (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {errorDe('metodo_pago')}
            </p>
          )}
        </fieldset>
      )}

      {usuario && (
        <fieldset>
          <legend className="text-lg font-bold text-stone-800">{(hospedaje ? 3 : 2) + (gratuita ? 1 : 2)}. ¿Dónde te avisamos?</legend>
          <div className="mt-2">
            <CampoTexto
              id="reserva-correo"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              maxLength={255}
              placeholder="tu@correo.com"
              ayuda="Te escribiremos cuando el anfitrión confirme o rechace tu reserva, y cuando se registre el pago."
              value={correo}
              error={errorDe('correo') ?? undefined}
              onChange={(v) => {
                setCorreo(v)
                if (error?.campo === 'correo') setError(null)
              }}
              onBlur={() => {}}
            />
          </div>
        </fieldset>
      )}

      <div className="border-t border-stone-200 pt-4">
        {!gratuita && (
          <p className="flex justify-between text-sm text-stone-600">
            <span>
              {formatearPrecio(exp.precio_por_persona)} × {plural(personasValidas, 'persona', 'personas')}
              {hospedaje && ` × ${plural(nochesValidas, 'noche', 'noches')}`}
            </span>
          </p>
        )}
        <p className="mt-1 flex items-baseline justify-between">
          <span className="font-semibold text-stone-800">Total</span>
          <span className="text-2xl font-bold text-campo-700" aria-live="polite">
            {formatearPrecio(total)}
          </span>
        </p>
      </div>

      {errorGeneral && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorGeneral}
        </p>
      )}

      {usuario && !usuario.nombre ? (
        // Cuentas creadas antes de que el nombre fuera obligatorio: el backend no deja reservar sin él
        <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          Para reservar, agrega tu nombre en{' '}
          <Link to="/mi-cuenta" className="font-medium underline">
            Mi cuenta
          </Link>
          : el anfitrión necesita saber quién lo visita.
        </p>
      ) : usuario ? (
        <button
          type="submit"
          disabled={enviando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-campo-600 py-3 font-semibold text-white shadow transition hover:bg-campo-700 disabled:cursor-wait disabled:opacity-60"
        >
          {enviando && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
          {enviando ? 'Reservando…' : 'Reservar'}
        </button>
      ) : (
        <Link
          to="/ingresar"
          state={{ desde: location.pathname }}
          className="flex w-full items-center justify-center rounded-lg bg-campo-600 py-3 font-semibold text-white shadow transition hover:bg-campo-700"
        >
          Inicia sesión para reservar
        </Link>
      )}
    </form>
  )
}

function ConfirmacionReserva({ reserva, onOtra }: { reserva: Reserva; onOtra: () => void }) {
  return (
    <div role="status" className="rounded-xl bg-campo-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-campo-700">
        <CircleCheck className="size-5" aria-hidden />
        ¡Reserva enviada!
      </p>
      <dl className="mt-3 space-y-1 text-sm">
        {(
          [
            ...(esEstadia(reserva)
              ? [
                  ['Llegada', formatoFechaLarga.format(desdeIso(reserva.fecha))],
                  ['Salida', formatoFechaLarga.format(desdeIso(reserva.fecha_salida))],
                  ['Noches', String(reserva.noches)],
                ]
              : [['Fecha', formatoFechaLarga.format(desdeIso(reserva.fecha))]]),
            ['Personas', String(reserva.personas)],
            ['Total', formatearPrecio(reserva.total)],
            ...(reserva.metodo_pago ? [['Pago', METODOS_PAGO[reserva.metodo_pago].nombre]] : []),
            ['Estado', NOMBRE_ESTADO_RESERVA[reserva.estado]],
          ] as [string, string][]
        ).map(([termino, valor]) => (
          <div key={termino} className="flex justify-between gap-3">
            <dt className="text-stone-600">{termino}</dt>
            <dd className="text-right font-medium text-stone-800 first-letter:uppercase">{valor}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-stone-600">
        Tus cupos ya están apartados. El anfitrión te contactará para confirmar
        {reserva.metodo_pago === 'transferencia' ? ' y enviarte los datos para la transferencia' : ''}
        {reserva.metodo_pago === 'en_linea' ? '. Cuando la confirme, podrás pagarla desde Mis reservas' : ''}.
        {reserva.correo && (
          <>
            {' '}
            Te avisaremos a <span className="font-medium text-stone-800">{reserva.correo}</span> cada cambio de estado.
          </>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
        <Link to="/mis-reservas" className="text-campo-600 hover:underline">
          Ver mis reservas
        </Link>
        <button type="button" onClick={onOtra} className="text-campo-600 hover:underline">
          Hacer otra reserva
        </button>
      </div>
    </div>
  )
}

type PropsContador = {
  valor: number
  maximo: number
  /** Lo que se muestra entre los botones, p. ej. "2 personas" */
  texto: string
  etiquetaMenos: string
  etiquetaMas: string
  onChange: (valor: number) => void
}

/** Botones − y + para elegir un número entre 1 y `maximo` */
function Contador({ valor, maximo, texto, etiquetaMenos, etiquetaMas, onChange }: PropsContador) {
  const estiloBoton =
    'flex size-12 items-center justify-center rounded-full border-2 border-stone-500 text-stone-700 transition hover:bg-stone-50 disabled:opacity-40'
  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(valor - 1, 1))}
        disabled={valor <= 1}
        aria-label={etiquetaMenos}
        className={estiloBoton}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-16 text-center font-semibold text-stone-800">
        {texto}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(valor + 1, maximo))}
        disabled={valor >= maximo}
        aria-label={etiquetaMas}
        className={estiloBoton}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}
