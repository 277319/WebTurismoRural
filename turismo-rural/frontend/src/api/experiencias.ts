import { apiFetch, errorDesdeRespuesta } from './cliente'
import type { Redes } from './emprendimientos'

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

/** GET /experiencias/{id}: incluye los datos públicos del emprendimiento anfitrión */
export type ExperienciaDetalle = Experiencia & {
  emprendimiento: Experiencia['emprendimiento'] & {
    localidad: string
    descripcion: string | null
    telefono_contacto: string
    redes: Redes
    usuario_id: number
  }
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

export type FiltrosCatalogo = {
  /** Parte del nombre; el backend no distingue mayúsculas ni tildes */
  localidad?: string
  tipos?: TipoExperiencia[]
  precioMin?: number
  precioMax?: number
}

/** Catálogo público: solo experiencias activas que cumplen los filtros, paginadas. */
export async function catalogoExperiencias(
  pagina = 1,
  porPagina = 12,
  filtros: FiltrosCatalogo = {},
): Promise<Pagina<Experiencia>> {
  const params = new URLSearchParams({ pagina: String(pagina), por_pagina: String(porPagina) })
  if (filtros.localidad?.trim()) params.set('localidad', filtros.localidad.trim())
  filtros.tipos?.forEach((tipo) => params.append('tipo', tipo))
  if (filtros.precioMin !== undefined) params.set('precio_min', String(filtros.precioMin))
  if (filtros.precioMax !== undefined) params.set('precio_max', String(filtros.precioMax))
  return json(await apiFetch(`/experiencias?${params}`))
}

/** Localidades con experiencias activas, para sugerirlas en el filtro. */
export async function localidadesCatalogo(): Promise<string[]> {
  return json(await apiFetch('/experiencias/localidades'))
}

/** Pública si está activa; si está pausada, solo su dueño la puede ver. */
export async function obtenerExperiencia(id: number): Promise<ExperienciaDetalle> {
  return json(await apiFetch(`/experiencias/${id}`))
}

export async function misExperiencias(): Promise<Experiencia[]> {
  return json(await apiFetch('/experiencias/mias'))
}

export async function crearExperiencia(datos: DatosExperiencia): Promise<Experiencia> {
  return json(await apiFetch('/experiencias', { method: 'POST', body: JSON.stringify(datos) }))
}

/** Reemplaza todos los datos de la experiencia (las fotos se gestionan aparte). */
export async function editarExperiencia(id: number, datos: DatosExperiencia): Promise<Experiencia> {
  return json(await apiFetch(`/experiencias/${id}`, { method: 'PUT', body: JSON.stringify(datos) }))
}

/** Pausa o reanuda la experiencia; las pausadas no aparecen en el catálogo. */
export async function cambiarEstadoExperiencia(id: number, estado: EstadoExperiencia): Promise<Experiencia> {
  return json(await apiFetch(`/experiencias/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }))
}

/** Borra la experiencia y su galería. No se puede deshacer. */
export async function eliminarExperiencia(id: number): Promise<void> {
  const res = await apiFetch(`/experiencias/${id}`, { method: 'DELETE' })
  if (!res.ok) throw await errorDesdeRespuesta(res)
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
