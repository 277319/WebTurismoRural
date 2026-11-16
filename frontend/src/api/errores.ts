// Mensajes que ve el usuario cuando una llamada a la API falla

export const MENSAJE_SIN_CONEXION =
  'No pudimos conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.'
export const MENSAJE_TIEMPO_AGOTADO =
  'El servidor está tardando demasiado en responder. Inténtalo de nuevo en unos momentos.'
export const MENSAJE_INESPERADO = 'Ocurrió un error inesperado. Inténtalo de nuevo.'

/** Mensaje por código HTTP, para cuando el backend no envía uno propio (o es un error del servidor). */
export function mensajePorEstado(status: number): string {
  switch (status) {
    case 400:
      return 'La solicitud no es válida. Revisa los datos e inténtalo de nuevo.'
    case 401:
      return 'Tu sesión expiró. Inicia sesión nuevamente para continuar.'
    case 403:
      return 'No tienes permiso para realizar esta acción.'
    case 404:
      return 'No encontramos lo que buscabas. Es posible que ya no exista.'
    case 409:
      return 'Ya existe un registro con esos datos.'
    case 413:
      return 'El archivo es demasiado grande.'
    case 415:
      return 'El formato del archivo no es compatible.'
    case 422:
      return 'Algunos datos no son válidos. Revisa el formulario.'
    case 429:
      return 'Hiciste demasiadas solicitudes seguidas. Espera un momento e inténtalo de nuevo.'
    case 502:
    case 503:
    case 504:
      return 'El servicio no está disponible en este momento. Inténtalo de nuevo en unos minutos.'
    default:
      return status >= 500
        ? 'Tuvimos un problema en el servidor. Inténtalo de nuevo en unos minutos.'
        : MENSAJE_INESPERADO
  }
}

type ErrorPydantic = { type: string; loc: (string | number)[]; msg: string; ctx?: Record<string, unknown> }

/** Traduce al español los errores de validación de Pydantic más comunes. */
export function traducirErrorValidacion(error: ErrorPydantic): string {
  const ctx = error.ctx ?? {}
  switch (error.type) {
    case 'value_error':
      return error.msg.replace(/^Value error, /, '')
    case 'missing':
      return 'Este campo es obligatorio'
    case 'string_too_short':
      return 'Este campo es obligatorio'
    case 'string_too_long':
      return `Es demasiado largo (máximo ${ctx.max_length} caracteres)`
    case 'greater_than_equal':
      return `Debe ser mayor o igual a ${ctx.ge}`
    case 'greater_than':
      return `Debe ser mayor que ${ctx.gt}`
    case 'less_than_equal':
      return `Debe ser menor o igual a ${ctx.le}`
    case 'less_than':
      return `Debe ser menor que ${ctx.lt}`
    case 'int_parsing':
    case 'int_type':
    case 'float_parsing':
    case 'float_type':
    case 'decimal_parsing':
    case 'decimal_type':
      return 'Debe ser un número válido'
    case 'decimal_max_places':
      return `Máximo ${ctx.decimal_places} decimales`
    case 'decimal_max_digits':
      return 'El número es demasiado grande'
    case 'enum':
    case 'literal_error':
      return 'La opción elegida no es válida'
    case 'extra_forbidden':
      return 'Este campo no está permitido'
    case 'json_invalid':
      return 'Los datos enviados no tienen un formato válido'
    default:
      return 'Este valor no es válido'
  }
}

/** Convierte cualquier error capturado en un mensaje legible. */
export function mensajeDeError(err: unknown): string {
  return err instanceof Error && err.message ? err.message : MENSAJE_INESPERADO
}
