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

export type Experiencia = DatosExperiencia & {
  id: number
  emprendimiento: { id: number; nombre: string; foto_url: string | null }
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

const formatoPrecio = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })

export function formatearPrecio(precio: number): string {
  return precio === 0 ? 'Gratis' : `$${formatoPrecio.format(precio)}`
}
