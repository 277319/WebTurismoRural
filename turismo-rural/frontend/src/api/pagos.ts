import { apiFetch, errorDesdeRespuesta } from './cliente'
import type { Reserva } from './reservas'

export type EstadoPago = 'pendiente' | 'aprobado' | 'rechazado'

export type Pago = {
  id: number
  reserva_id: number
  reserva: Reserva
  /** "simulado" o "mercadopago" */
  proveedor: string
  monto: number
  estado: EstadoPago
  fecha_creacion: string
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorDesdeRespuesta(res)
  return res.json()
}

/** Crea el cobro de una reserva confirmada y devuelve la página del proveedor donde se paga. */
export async function iniciarPago(reservaId: number): Promise<{ id: number; url_pago: string }> {
  return json(await apiFetch('/pagos', { method: 'POST', body: JSON.stringify({ reserva_id: reservaId }) }))
}

/** Lleva al visitante a pagar la reserva (sale del sitio si el proveedor es externo). */
export async function irAPagar(reservaId: number): Promise<void> {
  const { url_pago } = await iniciarPago(reservaId)
  window.location.assign(url_pago)
}

export async function obtenerPago(id: number): Promise<Pago> {
  return json(await apiFetch(`/pagos/${id}`))
}

/** Solo con la pasarela simulada: el resultado llega después al webhook, mientras el pago sigue pendiente. */
export async function simularPago(id: number, aprobar: boolean): Promise<Pago> {
  return json(await apiFetch(`/pagos/${id}/simular`, { method: 'POST', body: JSON.stringify({ aprobar }) }))
}
