import {
  MENSAJE_SIN_CONEXION,
  MENSAJE_TIEMPO_AGOTADO,
  mensajePorEstado,
  traducirErrorValidacion,
} from './errores'

const CLAVE_TOKEN = 'token'

export const EVENTO_SESION_EXPIRADA = 'sesion-expirada'

export function obtenerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN)
  } catch {
    return null
  }
}

export function guardarToken(token: string) {
  try {
    localStorage.setItem(CLAVE_TOKEN, token)
  } catch {
    // almacenamiento no disponible (modo privado, etc.): la sesión dura lo que la pestaña
  }
}

export function borrarToken() {
  try {
    localStorage.removeItem(CLAVE_TOKEN)
  } catch {
    // ignorar
  }
}

/** URL pública de un archivo servido por el backend (p. ej. foto_url = "/uploads/...") */
export function urlArchivo(ruta: string | null | undefined): string | null {
  return ruta ? `/api${ruta}` : null
}

export type TipoErrorApi = 'conexion' | 'tiempo' | 'respuesta'

/**
 * Error devuelto por la API. `campo` indica qué campo del formulario lo causó,
 * con notación de puntos para campos anidados (p. ej. "emprendimiento.localidad").
 */
export class ErrorApi extends Error {
  campo: string | null
  status: number | null
  tipo: TipoErrorApi

  constructor(mensaje: string, campo: string | null = null, status: number | null = null, tipo: TipoErrorApi = 'respuesta') {
    super(mensaje)
    this.campo = campo
    this.status = status
    this.tipo = tipo
  }
}

/** Convierte una respuesta de error de FastAPI en un ErrorApi con un mensaje legible. */
export async function errorDesdeRespuesta(res: Response): Promise<ErrorApi> {
  // Errores del servidor: nunca mostramos el detalle técnico
  if (res.status >= 500) return new ErrorApi(mensajePorEstado(res.status), null, res.status)

  const cuerpo = await res.json().catch(() => null)
  const detail = cuerpo?.detail

  // HTTPException con mensaje simple: { detail: "..." }
  if (typeof detail === 'string' && detail) return new ErrorApi(detail, null, res.status)

  // Error asociado a un campo: { detail: { campo, mensaje } }
  if (detail?.mensaje) return new ErrorApi(detail.mensaje, detail.campo ?? null, res.status)

  // Validación de Pydantic: { detail: [{ type, loc: ["body", "emprendimiento", "localidad"], msg }] }
  if (Array.isArray(detail) && detail.length > 0) {
    const [error] = detail
    const ruta = error.loc.slice(1).join('.') // quita "body" / "query"
    return new ErrorApi(traducirErrorValidacion(error), ruta || null, res.status)
  }

  return new ErrorApi(mensajePorEstado(res.status), null, res.status)
}

const TIEMPO_MAXIMO_MS = 20_000

/**
 * fetch hacia el backend: antepone /api, envía JSON (o FormData para archivos) y adjunta
 * el token JWT (Authorization: Bearer ...) en cada petición si hay sesión iniciada.
 */
export async function apiFetch(ruta: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  // Con FormData el navegador pone el Content-Type (multipart con su boundary)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = obtenerToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`/api${ruta}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(TIEMPO_MAXIMO_MS) })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ErrorApi(MENSAJE_TIEMPO_AGOTADO, null, null, 'tiempo')
    }
    throw new ErrorApi(MENSAJE_SIN_CONEXION, null, null, 'conexion')
  }

  // Si enviamos un token y el backend lo rechaza, la sesión ya no es válida
  if (res.status === 401 && token) {
    borrarToken()
    window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA))
  }

  return res
}
