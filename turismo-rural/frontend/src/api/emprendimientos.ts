import type { DatosEmprendimiento } from '../validacion'
import { apiFetch, errorDesdeRespuesta } from './cliente'

export type RedSocial = 'instagram' | 'facebook' | 'tiktok' | 'whatsapp' | 'sitio_web'
export type Redes = Partial<Record<RedSocial, string>>

export type TipoBloque = 'gastronomia' | 'festividades' | 'normas_visita'
/** Al desactivar un bloque se conserva su contenido para poder reactivarlo */
export type Bloque = { activo: boolean; contenido: string | null }
export type Bloques = Record<TipoBloque, Bloque>

/** Cuerpo de PUT /emprendimientos/{id}/personalizacion. La portada se sube aparte. */
export type DatosPersonalizacion = {
  /** '#rrggbb' */
  color_primario: string
  color_secundario: string
  relato_comunidad: string | null
  bloques: Bloques
}

export type Emprendimiento = DatosEmprendimiento & DatosPersonalizacion & {
  id: number
  descripcion: string | null
  historia: string | null
  redes: Redes
  foto_url: string | null
  portada_url: string | null
  usuario_id: number
  fecha_creacion: string
  fecha_actualizacion: string
}

/** Cuerpo de PUT /emprendimientos/{id}: reemplaza todos los datos */
export type DatosEdicionEmprendimiento = DatosEmprendimiento & {
  descripcion: string | null
  historia: string | null
  redes: Redes
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorDesdeRespuesta(res)
  return res.json()
}

export async function misEmprendimientos(): Promise<Emprendimiento[]> {
  return json(await apiFetch('/emprendimientos/mios'))
}

export async function obtenerEmprendimiento(id: number): Promise<Emprendimiento> {
  return json(await apiFetch(`/emprendimientos/${id}`))
}

export async function crearEmprendimiento(datos: DatosEmprendimiento): Promise<Emprendimiento> {
  return json(await apiFetch('/emprendimientos', { method: 'POST', body: JSON.stringify(datos) }))
}

export async function editarEmprendimiento(id: number, datos: DatosEdicionEmprendimiento): Promise<Emprendimiento> {
  return json(await apiFetch(`/emprendimientos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }))
}

export async function subirFotoEmprendimiento(id: number, foto: File): Promise<Emprendimiento> {
  const cuerpo = new FormData()
  cuerpo.append('foto', foto)
  return json(await apiFetch(`/emprendimientos/${id}/foto`, { method: 'PUT', body: cuerpo }))
}

export async function personalizarEmprendimiento(id: number, datos: DatosPersonalizacion): Promise<Emprendimiento> {
  return json(await apiFetch(`/emprendimientos/${id}/personalizacion`, { method: 'PUT', body: JSON.stringify(datos) }))
}

export async function subirPortadaEmprendimiento(id: number, portada: File): Promise<Emprendimiento> {
  const cuerpo = new FormData()
  cuerpo.append('portada', portada)
  return json(await apiFetch(`/emprendimientos/${id}/portada`, { method: 'PUT', body: cuerpo }))
}

export async function quitarPortadaEmprendimiento(id: number): Promise<Emprendimiento> {
  return json(await apiFetch(`/emprendimientos/${id}/portada`, { method: 'DELETE' }))
}
