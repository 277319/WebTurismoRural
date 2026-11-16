import { useCallback, useEffect, useState, type DependencyList } from 'react'

type Estado<T> = { datos: T | null; error: unknown; cargando: boolean }

/**
 * Ejecuta `cargar` al montar y cada vez que cambian `deps`.
 * Ignora respuestas que llegan tarde (p. ej. si se cambió de página antes de que respondiera).
 */
export function useCarga<T>(cargar: () => Promise<T>, deps: DependencyList) {
  const [estado, setEstado] = useState<Estado<T>>({ datos: null, error: null, cargando: true })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setEstado((e) => ({ ...e, error: null, cargando: true }))
    cargar()
      .then((datos) => vigente && setEstado({ datos, error: null, cargando: false }))
      .catch((error) => vigente && setEstado((e) => ({ ...e, error, cargando: false })))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])

  /** Reemplaza los datos localmente (p. ej. tras guardar), sin volver a llamar a la API. */
  const setDatos = useCallback((datos: T | ((previos: T | null) => T)) => {
    setEstado((e) => ({ ...e, datos: typeof datos === 'function' ? (datos as (p: T | null) => T)(e.datos) : datos }))
  }, [])

  return { ...estado, recargar, setDatos }
}
