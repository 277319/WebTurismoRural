import { apiFetch, errorDesdeRespuesta } from './cliente'

export type TipoExperiencia =
  | 'senderismo'
  | 'cabalgata'
  | 'gastronomia'
  | 'agroturismo'
  | 'artesania'
  | 'pesca'
  | 'acuatica'
  | 'avistamiento'
  | 'cultural'

export type EstadoExperiencia = 'activo' | 'pausado'

export type DatosExperiencia = {
  emprendimiento_id: number
  tipo: TipoExperiencia
  titulo: string
  descripcion: string
  precio_por_persona: number
  capacidad_maxima: number
  localidad: string
  latitud: number | null
  longitud: number | null
  estado: EstadoExperiencia
}

/** Mismos límites que el backend (MAX_FOTOS_EXPERIENCIA y MAX_FOTO_EXPERIENCIA_MB) */
export const MAX_FOTOS_EXPERIENCIA = 8
export const MAX_FOTO_EXPERIENCIA_MB = 10

export type FotoExperiencia = {
  id: number
  /** Ruta pública, p. ej. "/uploads/experiencias/abc123.webp" (usar con urlArchivo) */
  url: string
  /** Posición desde 0; la primera es la foto principal */
  orden: number
}

export type Experiencia = DatosExperiencia & {
  id: number
  emprendimiento: { id: number; nombre: string; foto_url: string | null }
  fotos: FotoExperiencia[]
  fecha_creacion: string
  fecha_actualizacion: string
}

export type Pagina<T> = {
  items: T[]
  total: number
  pagina: number
  por_pagina: number
  paginas: number
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorDesdeRespuesta(res)
  return res.json()
}

/** Catálogo público: solo experiencias activas, paginadas. */
export async function catalogoExperiencias(pagina = 1, porPagina = 12): Promise<Pagina<Experiencia>> {
  const params = new URLSearchParams({ pagina: String(pagina), por_pagina: String(porPagina) })
  return json(await apiFetch(`/experiencias?${params}`))
}

export async function misExperiencias(): Promise<Experiencia[]> {
  return json(await apiFetch('/experiencias/mias'))
}

export async function crearExperiencia(datos: DatosExperiencia): Promise<Experiencia> {
  return json(await apiFetch('/experiencias', { method: 'POST', body: JSON.stringify(datos) }))
}

/** Agrega una foto al final de la galería; el backend la redimensiona y comprime. */
export async function subirFotoExperiencia(experienciaId: number, foto: File): Promise<FotoExperiencia> {
  const cuerpo = new FormData()
  cuerpo.append('foto', foto)
  // Sin el límite de 20 s por defecto: con conexiones rurales lentas una foto grande puede tardar más
  return json(await apiFetch(`/experiencias/${experienciaId}/fotos`, { method: 'POST', body: cuerpo, signal: AbortSignal.timeout(120_000) }))
}

/** Envía los ids de todas las fotos en el nuevo orden; devuelve la galería guardada. */
export async function reordenarFotosExperiencia(experienciaId: number, ids: number[]): Promise<FotoExperiencia[]> {
  return json(await apiFetch(`/experiencias/${experienciaId}/fotos/orden`, { method: 'PUT', body: JSON.stringify({ ids }) }))
}

/** Elimina la foto; devuelve las fotos que quedan. */
export async function eliminarFotoExperiencia(experienciaId: number, fotoId: number): Promise<FotoExperiencia[]> {
  return json(await apiFetch(`/experiencias/${experienciaId}/fotos/${fotoId}`, { method: 'DELETE' }))
}

const formatoPrecio = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })

export function formatearPrecio(precio: number): string {
  return precio === 0 ? 'Gratis' : `$${formatoPrecio.format(precio)}`
}
