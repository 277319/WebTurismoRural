import { useEffect, useRef, useState } from 'react'

export const MAX_IMAGEN_MB = 5
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']

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
      if (!TIPOS_IMAGEN.includes(archivo.type)) {
        setError('La foto debe ser JPG, PNG o WebP.')
        return
      }
      if (archivo.size > MAX_IMAGEN_MB * 1024 * 1024) {
        setError(`La foto no puede superar los ${MAX_IMAGEN_MB} MB.`)
        return
      }
      setError(null)
      cambiar(archivo)
    },
    descartar() {
      cambiar(null)
    },
  }
}
