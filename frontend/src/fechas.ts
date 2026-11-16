// Fechas de calendario: se trabaja con 'YYYY-MM-DD' en hora local para no correr días por la zona horaria

export function aIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export function desdeIso(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias)
}

/** Hoy a las 00:00 en hora local */
export function hoyLocal(): Date {
  const ahora = new Date()
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
}

/** "lun, 10 nov" */
export const formatoDia = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
/** "lunes, 10 de noviembre de 2026" */
export const formatoFechaLarga = new Intl.DateTimeFormat('es-CL', { dateStyle: 'full' })
