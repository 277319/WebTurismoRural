import { ClipboardList, PartyPopper, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { urlArchivo } from './api/cliente'
import type { Bloques, Emprendimiento, TipoBloque } from './api/emprendimientos'
import type { CampoRed } from './validacion'

// --- Paletas de colores ---

export type Paleta = { id: string; nombre: string; primario: string; secundario: string }

/** La primera es la que tiene todo emprendimiento al crearse (igual que en el backend). */
export const PALETAS: Paleta[] = [
  { id: 'bosque', nombre: 'Bosque', primario: '#47702e', secundario: '#a0673a' },
  { id: 'lago', nombre: 'Lago', primario: '#1e5a7a', secundario: '#d9a441' },
  { id: 'cosecha', nombre: 'Cosecha', primario: '#a4502a', secundario: '#6b7f3a' },
  { id: 'cordillera', nombre: 'Cordillera', primario: '#3f4d63', secundario: '#b5651d' },
]

export const COLOR_RE = /^#[0-9a-f]{6}$/i

/** Id de la paleta predefinida que coincide con los colores, o 'libre'. */
export function paletaDe(primario: string, secundario: string): string {
  return PALETAS.find((p) => p.primario === primario && p.secundario === secundario)?.id ?? 'libre'
}

type Rgb = [number, number, number]

function aRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function aHex(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

/** Mezcla `hex` con `con` en la proporción `t` (0 = solo hex, 1 = solo con). */
function mezclar(hex: string, con: string, t: number): string {
  const a = aRgb(hex)
  const b = aRgb(con)
  return aHex(a.map((c, i) => c + (b[i] - c) * t) as Rgb)
}

/** Luminancia relativa según WCAG */
function luminancia(hex: string): number {
  const [r, g, b] = aRgb(hex).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

const BLANCO = '#ffffff'
const NEGRO = '#000000'
const TINTA = '#1c1917' // stone-900

/** Texto blanco u oscuro, el que mejor se lea sobre `fondo`. */
function textoSobre(fondo: string): string {
  return contraste(fondo, BLANCO) >= contraste(fondo, TINTA) ? BLANCO : TINTA
}

/** Oscurece `color` hasta que se lea sobre `fondo` con contraste AA (4.5:1). */
function legibleSobre(color: string, fondo: string): string {
  let resultado = color
  for (let t = 0.1; contraste(resultado, fondo) < 4.5 && t <= 1; t += 0.1) resultado = mezclar(color, NEGRO, t)
  return resultado
}

/** Para el color libre: el secundario es un tono más oscuro (o más claro, si el color ya es oscuro). */
export function derivarSecundario(primario: string): string {
  return luminancia(primario) > 0.18 ? mezclar(primario, NEGRO, 0.4) : mezclar(primario, BLANCO, 0.45)
}

/**
 * Variables CSS con los colores del emprendimiento. Se aplican con `style` en el contenedor
 * de la ficha y los elementos las usan con clases como `bg-(--marca)` o `text-(--marca-tinta)`.
 *  --marca / --marca-2          colores elegidos (fondos, acentos)
 *  --marca-texto / --marca-2-texto  texto legible encima de cada uno
 *  --marca-suave                fondo muy claro del color primario
 *  --marca-tinta                primario ajustado para leerse como texto sobre blanco
 */
export function variablesTema(primario: string, secundario: string): CSSProperties {
  const p = COLOR_RE.test(primario) ? primario.toLowerCase() : PALETAS[0].primario
  const s = COLOR_RE.test(secundario) ? secundario.toLowerCase() : PALETAS[0].secundario
  const suave = mezclar(p, BLANCO, 0.9)
  return {
    '--marca': p,
    '--marca-texto': textoSobre(p),
    '--marca-suave': suave,
    '--marca-tinta': legibleSobre(p, suave),
    '--marca-2': s,
    '--marca-2-texto': textoSobre(s),
  } as CSSProperties
}

// --- Bloques opcionales de contenido ---

export const TIPOS_BLOQUE: TipoBloque[] = ['gastronomia', 'festividades', 'normas_visita']

export const MAX_BLOQUE = 2000
export const MAX_RELATO = 5000

export const BLOQUES_INFO: Record<TipoBloque, { titulo: string; descripcion: string; placeholder: string; Icono: LucideIcon }> = {
  gastronomia: {
    titulo: 'Gastronomía típica',
    descripcion: 'Platos y productos de la zona que ofreces o recomiendas.',
    placeholder: 'Cazuela de campo, sopaipillas, mermelada de murta…',
    Icono: UtensilsCrossed,
  },
  festividades: {
    titulo: 'Festividades',
    descripcion: 'Fiestas y celebraciones de la comunidad a lo largo del año.',
    placeholder: 'We Tripantu en junio, Fiesta de la Vendimia en marzo…',
    Icono: PartyPopper,
  },
  normas_visita: {
    titulo: 'Normas de visita',
    descripcion: 'Lo que los visitantes deben saber para respetar el lugar y a su gente.',
    placeholder: 'Llevarse la basura. No alimentar a los animales. Pedir permiso antes de fotografiar a las personas…',
    Icono: ClipboardList,
  },
}

// --- Datos que muestra la ficha pública ---

export type DatosFicha = {
  nombre: string
  localidad: string
  direccion: string
  telefono: string
  descripcion: string
  historia: string
  /** Solo redes válidas y normalizadas */
  redes: Partial<Record<CampoRed, string>>
  fotoUrl: string | null
  portadaUrl: string | null
  colorPrimario: string
  colorSecundario: string
  relatoComunidad: string
  bloques: Bloques
}

export function datosFicha(e: Emprendimiento): DatosFicha {
  return {
    nombre: e.nombre,
    localidad: e.localidad,
    direccion: e.direccion,
    telefono: e.telefono_contacto,
    descripcion: e.descripcion ?? '',
    historia: e.historia ?? '',
    redes: e.redes,
    fotoUrl: urlArchivo(e.foto_url),
    portadaUrl: urlArchivo(e.portada_url),
    colorPrimario: e.color_primario,
    colorSecundario: e.color_secundario,
    relatoComunidad: e.relato_comunidad ?? '',
    bloques: e.bloques,
  }
}
