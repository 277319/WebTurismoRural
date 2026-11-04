import { Camera, Globe, MessageCircle, Music2, ThumbsUp, type LucideIcon } from 'lucide-react'
import type { CampoRed } from './validacion'

// lucide no incluye logotipos de marcas: se usan íconos genéricos junto al nombre de la red
export const REDES_INFO: Record<CampoRed, { nombre: string; Icono: LucideIcon; placeholder: string; prefijo?: string }> = {
  instagram: { nombre: 'Instagram', Icono: Camera, placeholder: 'tu.usuario o URL del perfil', prefijo: '@' },
  facebook: { nombre: 'Facebook', Icono: ThumbsUp, placeholder: 'NombreDePagina o URL' },
  tiktok: { nombre: 'TikTok', Icono: Music2, placeholder: 'tu.usuario o URL del perfil', prefijo: '@' },
  whatsapp: { nombre: 'WhatsApp', Icono: MessageCircle, placeholder: '+56 9 1234 5678' },
  sitio_web: { nombre: 'Sitio web', Icono: Globe, placeholder: 'www.tusitio.cl' },
}
