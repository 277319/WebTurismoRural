import { MapPin, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TipoExperiencia } from '../api/experiencias'
import { TIPOS_EXPERIENCIA } from '../tiposExperiencia'
import CampoTexto from './CampoTexto'

/** Parámetros de la URL que controla este panel (los mismos que acepta GET /experiencias) */
export type CambiosFiltros = Partial<Record<'localidad' | 'tipo' | 'precio_min' | 'precio_max', string | string[] | null>>

type Props = {
  /** Valores tal como están en la URL ('' si no hay) */
  localidad: string
  tipos: TipoExperiencia[]
  precioMin: string
  precioMax: string
  /** Sugerencias para el campo de localidad */
  localidades: string[]
  /** `reemplazar`: no agrega una entrada al historial (para lo que se aplica mientras se escribe) */
  onCambiar: (cambios: CambiosFiltros, reemplazar?: boolean) => void
}

const PRECIO_RE = /^\d+(\.\d{1,2})?$/
const ESPERA_MS = 400

/**
 * Texto de un campo que se aplica (p. ej. a la URL) un momento después de que el usuario deja de
 * escribir. Si el valor aplicado cambia desde fuera (atrás/adelante, "Limpiar filtros"), el campo lo refleja.
 */
function useTextoDiferido(valorAplicado: string, aplicar: (texto: string) => void) {
  const [texto, setTexto] = useState(valorAplicado)
  const [ultimoAplicado, setUltimoAplicado] = useState(valorAplicado)
  if (valorAplicado !== ultimoAplicado) {
    setUltimoAplicado(valorAplicado)
    setTexto(valorAplicado)
  }

  const aplicarRef = useRef(aplicar)
  useEffect(() => {
    aplicarRef.current = aplicar
  })

  useEffect(() => {
    if (texto === valorAplicado) return
    const t = setTimeout(() => aplicarRef.current(texto), ESPERA_MS)
    return () => clearTimeout(t)
  }, [texto, valorAplicado])

  return {
    texto,
    setTexto,
    /** Aplica ya, sin esperar (al salir del campo) */
    confirmar: () => texto !== valorAplicado && aplicarRef.current(texto),
  }
}

function errorPrecio(texto: string): string | undefined {
  if (texto.trim() !== '' && !PRECIO_RE.test(texto.trim())) return 'Solo números, sin puntos'
}

function esRangoInvertido(desde: string, hasta: string): boolean {
  return PRECIO_RE.test(desde) && PRECIO_RE.test(hasta) && Number(desde) > Number(hasta)
}

export default function FiltrosCatalogo({ localidad, tipos, precioMin, precioMax, localidades, onCambiar }: Props) {
  // En pantallas pequeñas el panel se pliega para no tapar el catálogo
  const [abierto, setAbierto] = useState(false)

  const campoLocalidad = useTextoDiferido(localidad, (texto) => onCambiar({ localidad: texto.trim() ? texto : null }, true))

  /**
   * Los dos extremos se aplican juntos: así, al corregir "Desde", también se aplica un "Hasta" que
   * había quedado pendiente. Un campo con formato inválido conserva su valor anterior en la URL.
   */
  function aplicarPrecios({ min, max }: { min: string; max: string }) {
    const desde = min.trim()
    const hasta = max.trim()
    if (esRangoInvertido(desde, hasta)) return // el backend lo rechazaría
    const cambios: CambiosFiltros = {}
    if (!errorPrecio(desde)) cambios.precio_min = desde || null
    if (!errorPrecio(hasta)) cambios.precio_max = hasta || null
    onCambiar(cambios, true)
  }

  // Lo escrito en ambos campos de precio, para que cada uno pueda aplicar el rango completo
  const textosPrecio = useRef({ min: precioMin, max: precioMax })
  const campoMin = useTextoDiferido(precioMin, (min) => aplicarPrecios({ ...textosPrecio.current, min }))
  const campoMax = useTextoDiferido(precioMax, (max) => aplicarPrecios({ ...textosPrecio.current, max }))
  useEffect(() => {
    textosPrecio.current = { min: campoMin.texto, max: campoMax.texto }
  })

  const errorMin = errorPrecio(campoMin.texto)
  const errorMax = errorPrecio(campoMax.texto)
  const rangoInvertido = esRangoInvertido(campoMin.texto.trim(), campoMax.texto.trim())

  function alternarTipo(tipo: TipoExperiencia) {
    onCambiar({ tipo: tipos.includes(tipo) ? tipos.filter((t) => t !== tipo) : [...tipos, tipo] })
  }

  const activos = (localidad ? 1 : 0) + tipos.length + (precioMin || precioMax ? 1 : 0)

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls="panel-filtros"
        className="mb-3 inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 sm:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtros
        {activos > 0 && <span className="rounded-full bg-campo-600 px-1.5 text-xs text-white">{activos}</span>}
      </button>

      <div
        id="panel-filtros"
        role="search"
        aria-label="Filtrar experiencias"
        className={`space-y-5 rounded-2xl bg-white p-4 shadow-sm sm:block sm:p-5 ${abierto ? '' : 'hidden'}`}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <CampoTexto
              id="filtro-localidad"
              label="Localidad"
              type="search"
              list="localidades-catalogo"
              autoComplete="off"
              maxLength={100}
              placeholder="Pucón, Curarrehue…"
              prefijo={<MapPin className="size-4" aria-hidden />}
              value={campoLocalidad.texto}
              onChange={campoLocalidad.setTexto}
              onBlur={campoLocalidad.confirmar}
            />
            <datalist id="localidades-catalogo">
              {localidades.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>

          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-stone-700">Precio por persona</legend>
            <div className="grid grid-cols-2 gap-3">
              <CampoTexto
                id="filtro-precio-min"
                label="Desde"
                type="text"
                inputMode="numeric"
                placeholder="0"
                prefijo="$"
                value={campoMin.texto}
                error={errorMin}
                onChange={campoMin.setTexto}
                onBlur={campoMin.confirmar}
              />
              <CampoTexto
                id="filtro-precio-max"
                label="Hasta"
                type="text"
                inputMode="numeric"
                placeholder="Sin límite"
                prefijo="$"
                value={campoMax.texto}
                error={errorMax ?? (rangoInvertido ? 'Debe ser mayor o igual a "Desde"' : undefined)}
                onChange={campoMax.setTexto}
                onBlur={campoMax.confirmar}
              />
            </div>
          </fieldset>
        </div>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-stone-700">Tipo de experiencia</legend>
          <div className="flex flex-wrap gap-2">
            {TIPOS_EXPERIENCIA.map(({ id, nombre, Icono }) => {
              const activo = tipos.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => alternarTipo(id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-campo-500 focus-visible:ring-offset-1 focus-visible:outline-none ${
                    activo
                      ? 'border-campo-600 bg-campo-600 text-white shadow-sm hover:bg-campo-700'
                      : 'border-stone-300 bg-white text-stone-600 hover:border-campo-500 hover:text-campo-700'
                  }`}
                >
                  <Icono className="size-4" aria-hidden />
                  {nombre}
                </button>
              )
            })}
          </div>
        </fieldset>

        {activos > 0 && (
          <button
            type="button"
            onClick={() => onCambiar({ localidad: null, tipo: null, precio_min: null, precio_max: null })}
            className="inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800 hover:underline"
          >
            <X className="size-4" aria-hidden />
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
