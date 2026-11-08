import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icono2xUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconoUrl from 'leaflet/dist/images/marker-icon.png'
import sombraUrl from 'leaflet/dist/images/marker-shadow.png'
import { useEffect, useRef } from 'react'

// Leaflet busca sus íconos con rutas relativas a su CSS, que se rompen al empaquetar con Vite:
// se importan las imágenes para que Vite les dé su URL final
const ICONO_MARCADOR = L.icon({
  iconUrl: iconoUrl,
  iconRetinaUrl: icono2xUrl,
  shadowUrl: sombraUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type Props = {
  latitud: number
  longitud: number
  /** Texto del marcador y nombre accesible del mapa */
  etiqueta: string
  zoom?: number
}

/** Mapa de OpenStreetMap con un marcador en las coordenadas indicadas. */
export default function MapaUbicacion({ latitud, longitud, etiqueta, zoom = 14 }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contenedor.current) return
    // Sin zoom con la rueda: si no, al hacer scroll por la página el mapa "atrapa" el cursor
    const mapa = L.map(contenedor.current, { scrollWheelZoom: false }).setView([latitud, longitud], zoom)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa)

    // Popup con textContent (no HTML): la etiqueta la escribe el anfitrión
    const popup = document.createElement('strong')
    popup.textContent = etiqueta
    L.marker([latitud, longitud], { icon: ICONO_MARCADOR, title: etiqueta, alt: etiqueta }).addTo(mapa).bindPopup(popup)

    return () => {
      mapa.remove()
    }
  }, [latitud, longitud, zoom, etiqueta])

  return (
    // `isolate`: los paneles de Leaflet usan z-index altos y si no quedarían por encima del encabezado del sitio
    <div ref={contenedor} role="region" aria-label={`Mapa: ${etiqueta}`} className="isolate h-72 w-full rounded-xl bg-stone-100 sm:h-80" />
  )
}
