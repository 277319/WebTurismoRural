import { useEffect, useRef, useState } from 'react'

export const MAX_IMAGEN_MB = 5
export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']

/** Valida tipo y tamaño con las mismas reglas que el backend. Devuelve el mensaje de error o null. */
export function errorImagen(archivo: File, maxMb = MAX_IMAGEN_MB): string | null {
  if (!TIPOS_IMAGEN.includes(archivo.type)) return 'La foto debe ser JPG, PNG o WebP.'
  if (archivo.size > maxMb * 1024 * 1024) return `La foto no puede superar los ${maxMb} MB.`
  return null
}

/**
 * Imagen elegida en un <input type="file"> pero aún no subida, con una URL temporal para la
 * vista previa. Valida tipo y tamaño (mismas reglas que el backend).
 */
export function useImagenPendiente() {
  const [pendiente, setPendiente] = useState<{ archivo: File; url: string } | null>(null)
  const urlTemporal = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function cambiar(archivo: File | null) {
    if (urlTemporal.current) URL.revokeObjectURL(urlTemporal.current)
    const url = archivo ? URL.createObjectURL(archivo) : null
    urlTemporal.current = url
    setPendiente(archivo && url ? { archivo, url } : null)
  }

  // Libera la URL temporal al salir de la página
  useEffect(() => () => {
    if (urlTemporal.current) URL.revokeObjectURL(urlTemporal.current)
  }, [])

  return {
    pendiente,
    error,
    setError,
    /** Valor para el atributo `accept` del input */
    tipos: TIPOS_IMAGEN.join(','),
    /** Toma el archivo del input y lo vacía, para poder volver a elegir el mismo archivo */
    elegir(input: HTMLInputElement) {
      const archivo = input.files?.[0]
      input.value = ''
      if (!archivo) return
      const invalida = errorImagen(archivo)
      setError(invalida)
      if (invalida) return
      cambiar(archivo)
    },
    descartar() {
      cambiar(null)
    },
  }
}
