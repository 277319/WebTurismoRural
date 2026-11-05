// Reglas de validación compartidas por los formularios (iguales a las del backend)

export const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const TELEFONO_RE = /^\+?\d{8,15}$/

export function limpiarTelefono(valor: string) {
  return valor.replace(/[\s\-().]/g, '')
}

export function telefonoValido(valor: string) {
  return TELEFONO_RE.test(limpiarTelefono(valor))
}

/** Nombre sin espacios sobrantes */
export function normalizarNombre(valor: string) {
  return valor.split(/\s+/).filter(Boolean).join(' ')
}

/** Mismas reglas que el backend; `obligatorio` para los visitantes, que necesitan nombre para reservar */
export function errorNombre(valor: string, obligatorio: boolean): string | undefined {
  const nombre = normalizarNombre(valor)
  if (!nombre) return obligatorio ? 'Ingresa tu nombre' : undefined
  if (nombre.length > 100) return 'Máximo 100 caracteres'
  if (!/\p{L}/u.test(nombre)) return 'El nombre debe contener letras'
}

export type CampoEmprendimiento = 'nombre' | 'telefono_contacto' | 'direccion' | 'localidad'
export type DatosEmprendimiento = Record<CampoEmprendimiento, string>
export type ErroresEmprendimiento = Partial<Record<CampoEmprendimiento, string>>

export const CAMPOS_EMPRENDIMIENTO: CampoEmprendimiento[] = ['nombre', 'telefono_contacto', 'direccion', 'localidad']

export const EMPRENDIMIENTO_VACIO: DatosEmprendimiento = {
  nombre: '',
  telefono_contacto: '',
  direccion: '',
  localidad: '',
}

const LIMITES: Record<CampoEmprendimiento, number> = {
  nombre: 150,
  telefono_contacto: 20,
  direccion: 255,
  localidad: 100,
}

const OBLIGATORIO: Record<CampoEmprendimiento, string> = {
  nombre: 'Ingresa el nombre del emprendimiento',
  telefono_contacto: 'Ingresa un teléfono de contacto',
  direccion: 'Ingresa la dirección',
  localidad: 'Ingresa la localidad',
}

export function validarEmprendimiento(datos: DatosEmprendimiento): ErroresEmprendimiento {
  const errores: ErroresEmprendimiento = {}
  for (const campo of CAMPOS_EMPRENDIMIENTO) {
    const valor = datos[campo].trim()
    if (!valor) errores[campo] = OBLIGATORIO[campo]
    else if (valor.length > LIMITES[campo]) errores[campo] = `Máximo ${LIMITES[campo]} caracteres`
  }
  if (!errores.telefono_contacto && !telefonoValido(datos.telefono_contacto)) {
    errores.telefono_contacto = 'El teléfono debe tener entre 8 y 15 dígitos'
  }
  return errores
}

/** Normaliza los datos antes de enviarlos: recorta espacios y limpia el teléfono. */
export function normalizarEmprendimiento(datos: DatosEmprendimiento): DatosEmprendimiento {
  return {
    nombre: datos.nombre.trim(),
    telefono_contacto: limpiarTelefono(datos.telefono_contacto),
    direccion: datos.direccion.trim(),
    localidad: datos.localidad.trim(),
  }
}

// --- Redes de contacto (mismas reglas que el backend) ---

export type CampoRed = 'instagram' | 'facebook' | 'tiktok' | 'whatsapp' | 'sitio_web'
export type ValoresRedes = Record<CampoRed, string>
export type ErroresRedes = Partial<Record<CampoRed, string>>

export const CAMPOS_REDES: CampoRed[] = ['instagram', 'facebook', 'tiktok', 'whatsapp', 'sitio_web']

const REDES_USUARIO: Partial<Record<CampoRed, { dominio: string; patron: RegExp; nombre: string }>> = {
  instagram: { dominio: 'instagram.com', patron: /^[A-Za-z0-9._]{1,30}$/, nombre: 'Instagram' },
  facebook: { dominio: 'facebook.com', patron: /^[A-Za-z0-9.-]{1,80}$/, nombre: 'Facebook' },
  tiktok: { dominio: 'tiktok.com', patron: /^[A-Za-z0-9._]{2,24}$/, nombre: 'TikTok' },
}

/** '@usuario', 'usuario' o la URL del perfil -> 'usuario' */
function extraerUsuario(dominio: string, valor: string): string {
  const dominioEscapado = dominio.replace(/\./g, String.raw`\.`)
  const url = new RegExp(String.raw`^(?:https?://)?(?:www\.|m\.)?${dominioEscapado}/@?([^/?#\s]+)`, 'i')
  return url.exec(valor)?.[1] ?? valor.replace(/^@/, '')
}

function normalizarSitioWeb(valor: string): string | null {
  const conEsquema = /^https?:\/\//i.test(valor) ? valor : `https://${valor}`
  try {
    const url = new URL(conEsquema)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || /\s/.test(valor)) return null
    return conEsquema
  } catch {
    return null
  }
}

/** Valor normalizado de una red, o null si está vacía o no es válida. */
export function normalizarRed(red: CampoRed, valor: string): string | null {
  const v = valor.trim()
  if (!v) return null
  if (red === 'whatsapp') return telefonoValido(v) ? limpiarTelefono(v) : null
  if (red === 'sitio_web') return normalizarSitioWeb(v)
  const config = REDES_USUARIO[red]!
  const usuario = extraerUsuario(config.dominio, v)
  return config.patron.test(usuario) ? usuario : null
}

export function validarRedes(redes: ValoresRedes): ErroresRedes {
  const errores: ErroresRedes = {}
  for (const red of CAMPOS_REDES) {
    const valor = redes[red].trim()
    if (!valor || normalizarRed(red, valor)) continue
    if (red === 'whatsapp') errores[red] = 'El teléfono debe tener entre 8 y 15 dígitos'
    else if (red === 'sitio_web') errores[red] = 'La dirección del sitio web no es válida'
    else errores[red] = `Usuario de ${REDES_USUARIO[red]!.nombre} no válido`
  }
  return errores
}

/** Solo las redes con un valor válido, ya normalizadas (para enviar o previsualizar). */
export function normalizarRedes(redes: ValoresRedes): Partial<Record<CampoRed, string>> {
  const resultado: Partial<Record<CampoRed, string>> = {}
  for (const red of CAMPOS_REDES) {
    const valor = normalizarRed(red, redes[red])
    if (valor) resultado[red] = valor
  }
  return resultado
}

/** Enlace público de una red a partir de su valor normalizado. */
export function enlaceRed(red: CampoRed, valor: string): string {
  switch (red) {
    case 'instagram':
      return `https://instagram.com/${encodeURIComponent(valor)}`
    case 'facebook':
      return `https://facebook.com/${encodeURIComponent(valor)}`
    case 'tiktok':
      return `https://www.tiktok.com/@${encodeURIComponent(valor)}`
    case 'whatsapp':
      return `https://wa.me/${valor.replace(/\D/g, '')}`
    case 'sitio_web':
      return valor
  }
}
