import { CreditCard, LoaderCircle, Phone, Store, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { mensajeDeError } from '../api/errores'
import { irAPagar } from '../api/pagos'
import {
  agruparReservas,
  cancelarReserva,
  esEstadia,
  explicacionEstado,
  misReservas,
  sePuedePagarEnLinea,
  type Reserva,
} from '../api/reservas'
import DialogoEliminar from '../components/DialogoEliminar'
import ErrorCarga from '../components/ErrorCarga'
import TarjetaReserva, { SeccionReservas } from '../components/TarjetaReserva'
import { aIso, desdeIso, formatoFechaLarga, hoyLocal } from '../fechas'
import { useCarga } from '../hooks/useCarga'

export default function MisReservas() {
  const { datos: reservas, error, cargando, recargar, setDatos } = useCarga(misReservas, [])
  const [aCancelar, setACancelar] = useState<Reserva | null>(null)
  const [hoy] = useState(() => aIso(hoyLocal()))
  // Reserva cuyo pago se está iniciando (al terminar, el navegador sale hacia el proveedor)
  const [pagando, setPagando] = useState<number | null>(null)
  const [errorPago, setErrorPago] = useState<{ id: number; mensaje: string } | null>(null)

  async function pagar(reserva: Reserva) {
    setPagando(reserva.id)
    setErrorPago(null)
    try {
      await irAPagar(reserva.id)
    } catch (err) {
      setErrorPago({ id: reserva.id, mensaje: mensajeDeError(err) })
      setPagando(null)
      // Puede que el anfitrión la haya cancelado o que ya esté pagada: se muestra el estado actual
      recargar()
    }
  }

  async function cancelar(reserva: Reserva) {
    const actualizada = await cancelarReserva(reserva.id)
    setDatos((lista) => (lista ?? []).map((r) => (r.id === actualizada.id ? actualizada : r)))
    setACancelar(null)
  }

  function tarjeta(r: Reserva, conAcciones: boolean) {
    const { experiencia } = r
    return (
      <TarjetaReserva
        key={r.id}
        reserva={r}
        atenuada={!conAcciones}
        explicacion={explicacionEstado(r, 'visitante')}
        error={errorPago?.id === r.id ? errorPago.mensaje : null}
        titulo={
          <Link to={`/experiencias/${experiencia.id}`} className="hover:underline">
            {experiencia.titulo}
          </Link>
        }
        detalle={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Store className="size-4" aria-hidden />
              {experiencia.emprendimiento.nombre} · {experiencia.localidad}
            </span>
            <a
              href={`tel:${experiencia.emprendimiento.telefono_contacto}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <Phone className="size-4" aria-hidden />
              {experiencia.emprendimiento.telefono_contacto}
            </a>
          </span>
        }
        acciones={
          (conAcciones || sePuedePagarEnLinea(r)) && (
            <>
              {/* También en las pasadas: hay quien paga después de la fecha */}
              {sePuedePagarEnLinea(r) && (
                <button
                  type="button"
                  onClick={() => pagar(r)}
                  disabled={pagando !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-campo-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-campo-700 disabled:opacity-60"
                >
                  {pagando === r.id ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CreditCard className="size-4" aria-hidden />
                  )}
                  {pagando === r.id ? 'Abriendo el pago…' : 'Pagar en línea'}
                </button>
              )}
              {conAcciones && (
                <button
                  type="button"
                  onClick={() => setACancelar(r)}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-600 px-4 py-2.5 text-base font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <X className="size-4" aria-hidden />
                  Cancelar reserva
                </button>
              )}
            </>
          )
        }
      />
    )
  }

  const grupos = reservas ? agruparReservas(reservas, hoy) : null

  return (
    <section className="w-full max-w-3xl">
      <h1 className="text-3xl font-bold text-campo-700">Mis reservas</h1>
      <p className="mt-1 mb-6 text-lg text-stone-700">
        Aquí ves todas tus reservas y en qué estado están. Desde aquí puedes pagarlas en línea o cancelarlas.
      </p>

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar tus reservas" onReintentar={recargar} />
      ) : !reservas || !grupos ? (
        <p className="text-stone-600">Cargando…</p>
      ) : reservas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center">
          <p className="text-stone-600">Aún no tienes reservas.</p>
          <Link to="/" className="mt-2 inline-block font-medium text-campo-600 hover:underline">
            Explorar experiencias
          </Link>
        </div>
      ) : (
        <>
          {grupos.proximas.length > 0 ? (
            <SeccionReservas titulo="Próximas">{grupos.proximas.map((r) => tarjeta(r, true))}</SeccionReservas>
          ) : (
            <p className="text-stone-600">No tienes reservas para los próximos días.</p>
          )}
          {grupos.pasadas.length > 0 && (
            <SeccionReservas titulo="Pasadas">{grupos.pasadas.map((r) => tarjeta(r, false))}</SeccionReservas>
          )}
          {grupos.canceladas.length > 0 && (
            <SeccionReservas titulo="Canceladas y rechazadas">{grupos.canceladas.map((r) => tarjeta(r, false))}</SeccionReservas>
          )}
        </>
      )}

      <DialogoEliminar
        abierto={aCancelar !== null}
        titulo="¿Cancelar tu reserva?"
        accion="Cancelar reserva"
        accionEnCurso="Cancelando…"
        onEliminar={() => cancelar(aCancelar!)}
        onCerrar={() => setACancelar(null)}
      >
        {aCancelar && (
          <>
            <p>
              <strong className="font-semibold text-stone-800">{aCancelar.experiencia.titulo}</strong>, el{' '}
              {formatoFechaLarga.format(desdeIso(aCancelar.fecha))}
              {esEstadia(aCancelar) && ` (${aCancelar.noches} ${aCancelar.noches === 1 ? 'noche' : 'noches'})`}. Tus cupos quedarán libres para otros visitantes.
            </p>
            {aCancelar.total > 0 && <p>Si ya pagaste, coordina la devolución con el anfitrión.</p>}
          </>
        )}
      </DialogoEliminar>
    </section>
  )
}
