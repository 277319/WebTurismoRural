import { ArrowLeft, Ban, Banknote, CalendarDays, Check, LoaderCircle, Mail, Phone, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorApi } from '../api/cliente'
import { mensajeDeError } from '../api/errores'
import { formatearPrecio, misExperiencias, type Experiencia } from '../api/experiencias'
import {
  agruparReservas,
  cancelarReserva,
  confirmarReserva,
  esCerrada,
  esEstadia,
  explicacionEstado,
  marcarReservaPagada,
  rechazarReserva,
  reservasDeExperiencia,
  type Reserva,
  type ReservaAnfitrion,
} from '../api/reservas'
import DialogoEliminar from '../components/DialogoEliminar'
import ErrorCarga from '../components/ErrorCarga'
import TarjetaReserva, { SeccionReservas } from '../components/TarjetaReserva'
import { aIso, desdeIso, formatoFechaLarga, hoyLocal } from '../fechas'
import { useCarga } from '../hooks/useCarga'

export default function ReservasExperiencia() {
  const { id } = useParams()
  const experienciaId = Number(id)
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const [experiencias, reservas] = await Promise.all([misExperiencias(), reservasDeExperiencia(experienciaId)])
    const experiencia = experiencias.find((e) => e.id === experienciaId)
    if (!experiencia) throw new ErrorApi('No encontramos esta experiencia entre las tuyas.', null, 404)
    return { experiencia, reservas }
  }, [experienciaId])

  return (
    <section className="w-full max-w-3xl">
      <Link
        to="/mis-experiencias"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-campo-600 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mis experiencias
      </Link>

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar las reservas" onReintentar={recargar} />
      ) : !datos ? (
        <p className="text-stone-600">Cargando…</p>
      ) : (
        <ListaReservas key={datos.experiencia.id} experiencia={datos.experiencia} reservasIniciales={datos.reservas} />
      )}
    </section>
  )
}

const nombreVisitante = (r: ReservaAnfitrion) =>
  r.visitante.nombre || r.visitante.correo || r.visitante.telefono || 'Visitante'

/** Adónde le llegan los avisos: el correo que indicó al reservar (o el de su cuenta, en reservas antiguas) */
const correoDe = (r: ReservaAnfitrion) => r.correo ?? r.visitante.correo

/** Acciones de un clic, sin diálogo de confirmación */
type AccionRapida = 'confirmar' | 'pagar'

const ACCIONES_RAPIDAS: Record<
  AccionRapida,
  { ejecutar: (id: number) => Promise<Reserva>; enCurso: string; error: string }
> = {
  confirmar: { ejecutar: confirmarReserva, enCurso: 'Confirmando…', error: 'No se pudo confirmar.' },
  pagar: { ejecutar: marcarReservaPagada, enCurso: 'Guardando…', error: 'No se pudo registrar el pago.' },
}

const BOTON_PRINCIPAL =
  'inline-flex items-center gap-1.5 rounded-lg bg-campo-600 px-4 py-2.5 text-base font-semibold text-white shadow transition hover:bg-campo-700 disabled:cursor-wait disabled:opacity-60'
const BOTON_PELIGRO =
  'inline-flex items-center gap-1.5 rounded-lg border-2 border-red-600 px-4 py-2.5 text-base font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60'

function ListaReservas({
  experiencia,
  reservasIniciales,
}: {
  experiencia: Experiencia
  reservasIniciales: ReservaAnfitrion[]
}) {
  const [reservas, setReservas] = useState(reservasIniciales)
  const [enCurso, setEnCurso] = useState<Record<number, AccionRapida>>({})
  const [errores, setErrores] = useState<Record<number, string>>({})
  const [aCancelar, setACancelar] = useState<ReservaAnfitrion | null>(null)
  const [aRechazar, setARechazar] = useState<ReservaAnfitrion | null>(null)
  const [hoy] = useState(() => aIso(hoyLocal()))

  const { proximas, pasadas, canceladas } = agruparReservas(reservas, hoy)
  const pendientes = proximas.filter((r) => r.estado === 'pendiente')
  // Confirmadas y pagadas
  const confirmadas = proximas.filter((r) => r.estado !== 'pendiente')

  // La respuesta no trae al visitante: se conserva el que ya teníamos
  function actualizar(actualizada: Reserva) {
    setReservas((lista) => lista.map((r) => (r.id === actualizada.id ? { ...r, ...actualizada } : r)))
  }

  function marcarError(id: number, mensaje: string | null) {
    setErrores((e) => {
      const resto = { ...e }
      if (mensaje) resto[id] = mensaje
      else delete resto[id]
      return resto
    })
  }

  async function ejecutar(reserva: ReservaAnfitrion, accion: AccionRapida) {
    const { ejecutar, error } = ACCIONES_RAPIDAS[accion]
    setEnCurso((e) => ({ ...e, [reserva.id]: accion }))
    marcarError(reserva.id, null)
    try {
      actualizar(await ejecutar(reserva.id))
    } catch (err) {
      marcarError(reserva.id, `${error} ${mensajeDeError(err)}`)
    } finally {
      setEnCurso((e) => {
        const resto = { ...e }
        delete resto[reserva.id]
        return resto
      })
    }
  }

  async function cancelar(reserva: ReservaAnfitrion) {
    actualizar(await cancelarReserva(reserva.id))
    marcarError(reserva.id, null)
    setACancelar(null)
  }

  async function rechazar(reserva: ReservaAnfitrion) {
    actualizar(await rechazarReserva(reserva.id))
    marcarError(reserva.id, null)
    setARechazar(null)
  }

  function botonRapido(r: ReservaAnfitrion, accion: AccionRapida, icono: ReactNode, texto: string) {
    const ocupada = r.id in enCurso
    const esta = enCurso[r.id] === accion
    return (
      <button type="button" onClick={() => ejecutar(r, accion)} disabled={ocupada} className={BOTON_PRINCIPAL}>
        {esta ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icono}
        {esta ? ACCIONES_RAPIDAS[accion].enCurso : texto}
      </button>
    )
  }

  function tarjeta(r: ReservaAnfitrion) {
    const pasada = r.fecha < hoy
    const cerrada = esCerrada(r)
    const ocupada = r.id in enCurso
    // El pago se puede registrar también después de la fecha, para quien paga al llegar
    const puedeCobrar = r.estado === 'confirmada' && r.total > 0
    const conAcciones = !cerrada && (!pasada || puedeCobrar)
    return (
      <TarjetaReserva
        key={r.id}
        reserva={r}
        titulo={nombreVisitante(r)}
        atenuada={pasada || cerrada}
        explicacion={explicacionEstado(r, 'anfitrion')}
        error={errores[r.id]}
        detalle={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {r.visitante.telefono && (
              <a href={`tel:${r.visitante.telefono}`} className="inline-flex items-center gap-1 hover:underline">
                <Phone className="size-4" aria-hidden />
                {r.visitante.telefono}
              </a>
            )}
            {correoDe(r) && (
              <a
                href={`mailto:${correoDe(r)}`}
                className="inline-flex items-center gap-1 break-all hover:underline"
              >
                <Mail className="size-4 shrink-0" aria-hidden />
                {correoDe(r)}
              </a>
            )}
          </span>
        }
        acciones={
          conAcciones && (
            <>
              {r.estado === 'pendiente' ? (
                <>
                  {botonRapido(r, 'confirmar', <Check className="size-4" aria-hidden />, 'Confirmar')}
                  <button type="button" onClick={() => setARechazar(r)} disabled={ocupada} className={BOTON_PELIGRO}>
                    <Ban className="size-4" aria-hidden />
                    Rechazar
                  </button>
                </>
              ) : (
                <>
                  {puedeCobrar &&
                    botonRapido(r, 'pagar', <Banknote className="size-4" aria-hidden />, 'Marcar como pagada')}
                  {!pasada && (
                    <button type="button" onClick={() => setACancelar(r)} disabled={ocupada} className={BOTON_PELIGRO}>
                      <X className="size-4" aria-hidden />
                      Cancelar reserva
                    </button>
                  )}
                </>
              )}
            </>
          )
        }
      />
    )
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-campo-700">Reservas</h1>
          <p className="mt-0.5 truncate text-lg text-stone-700">{experiencia.titulo}</p>
        </div>
        <Link
          to={`/experiencias/${experiencia.id}/disponibilidad`}
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-stone-500 bg-white px-4 py-2.5 text-base font-semibold text-stone-700 transition hover:bg-stone-50"
        >
          <CalendarDays className="size-5" aria-hidden />
          Fechas y cupos
        </Link>
      </div>

      <p className="mb-6 text-lg text-stone-700">
        Las solicitudes nuevas aparecen arriba, en «Por confirmar». Cada reserva dice qué tienes que hacer.
      </p>

      {reservas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-600">
          Aún no hay reservas para esta experiencia.
        </p>
      ) : (
        <>
          {pendientes.length > 0 && (
            <SeccionReservas titulo={`Por confirmar (${pendientes.length})`}>
              {pendientes.map((r) => tarjeta(r))}
            </SeccionReservas>
          )}
          {confirmadas.length > 0 && (
            <SeccionReservas titulo={`Confirmadas (${confirmadas.length})`}>
              {confirmadas.map((r) => tarjeta(r))}
            </SeccionReservas>
          )}
          {proximas.length === 0 && <p className="text-stone-600">No hay reservas para los próximos días.</p>}
          {pasadas.length > 0 && (
            <SeccionReservas titulo="Pasadas">{pasadas.map((r) => tarjeta(r))}</SeccionReservas>
          )}
          {canceladas.length > 0 && (
            <SeccionReservas titulo="Canceladas y rechazadas">{canceladas.map((r) => tarjeta(r))}</SeccionReservas>
          )}
        </>
      )}

      <DialogoEliminar
        abierto={aCancelar !== null}
        titulo="¿Cancelar esta reserva?"
        accion="Cancelar reserva"
        accionEnCurso="Cancelando…"
        onEliminar={() => cancelar(aCancelar!)}
        onCerrar={() => setACancelar(null)}
      >
        {aCancelar && (
          <>
            <p>
              Reserva de <strong className="font-semibold text-stone-800">{nombreVisitante(aCancelar)}</strong> para el{' '}
              {formatoFechaLarga.format(desdeIso(aCancelar.fecha))} ({aCancelar.personas}{' '}
              {aCancelar.personas === 1 ? 'persona' : 'personas'}
              {esEstadia(aCancelar) && `, ${aCancelar.noches} ${aCancelar.noches === 1 ? 'noche' : 'noches'}`}). Sus cupos
              volverán a quedar libres.
            </p>
            <p>El visitante verá la reserva como cancelada. Avísale tú para que no viaje en vano.</p>
            {aCancelar.estado === 'pagada' && (
              <p>Ya te pagó {formatearPrecio(aCancelar.total)}: coordina la devolución con el visitante.</p>
            )}
          </>
        )}
      </DialogoEliminar>

      <DialogoEliminar
        abierto={aRechazar !== null}
        titulo="¿Rechazar esta solicitud?"
        accion="Rechazar solicitud"
        accionEnCurso="Rechazando…"
        onEliminar={() => rechazar(aRechazar!)}
        onCerrar={() => setARechazar(null)}
      >
        {aRechazar && (
          <>
            <p>
              Solicitud de <strong className="font-semibold text-stone-800">{nombreVisitante(aRechazar)}</strong> para
              el {formatoFechaLarga.format(desdeIso(aRechazar.fecha))} ({aRechazar.personas}{' '}
              {aRechazar.personas === 1 ? 'persona' : 'personas'}
              {esEstadia(aRechazar) && `, ${aRechazar.noches} ${aRechazar.noches === 1 ? 'noche' : 'noches'}`}). Sus cupos
              volverán a quedar libres.
            </p>
            <p>
              {correoDe(aRechazar)
                ? 'Le avisaremos por correo para que pueda elegir otra fecha.'
                : 'No tiene correo registrado: avísale tú por teléfono.'}
            </p>
          </>
        )}
      </DialogoEliminar>
    </>
  )
}
