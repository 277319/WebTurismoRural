import {
  BedDouble,
  Binoculars,
  FishingRod,
  Footprints,
  Kayak,
  Landmark,
  Palette,
  PawPrint,
  Tractor,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { TipoExperiencia } from './api/experiencias'

export const TIPOS_EXPERIENCIA: { id: TipoExperiencia; nombre: string; Icono: LucideIcon }[] = [
  { id: 'senderismo', nombre: 'Senderismo', Icono: Footprints },
  { id: 'cabalgata', nombre: 'Cabalgata', Icono: PawPrint },
  { id: 'gastronomia', nombre: 'Gastronomía', Icono: UtensilsCrossed },
  { id: 'agroturismo', nombre: 'Agroturismo', Icono: Tractor },
  { id: 'artesania', nombre: 'Artesanía', Icono: Palette },
  { id: 'pesca', nombre: 'Pesca', Icono: FishingRod },
  { id: 'acuatica', nombre: 'Acuáticas', Icono: Kayak },
  { id: 'avistamiento', nombre: 'Avistamiento', Icono: Binoculars },
  { id: 'cultural', nombre: 'Cultural', Icono: Landmark },
  { id: 'hospedaje', nombre: 'Hospedaje', Icono: BedDouble },
]

export function tipoExperiencia(id: TipoExperiencia) {
  return TIPOS_EXPERIENCIA.find((t) => t.id === id) ?? TIPOS_EXPERIENCIA[0]
}

/** Los hospedajes se reservan por noches: el precio es por persona y noche, y los cupos de cada día son los de esa noche */
export const esHospedaje = (tipo: TipoExperiencia) => tipo === 'hospedaje'

/** Lo que acompaña al precio: "/ persona" o "/ persona por noche" */
export const unidadPrecio = (tipo: TipoExperiencia) => (esHospedaje(tipo) ? '/ persona por noche' : '/ persona')
