import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { urlArchivo } from '../api/cliente'
import { formatearPrecio, type Experiencia } from '../api/experiencias'
import { tipoExperiencia } from '../tiposExperiencia'

export default function TarjetaExperiencia({ experiencia }: { experiencia: Experiencia }) {
  const { Icono, nombre: nombreTipo } = tipoExperiencia(experiencia.tipo)
  const foto = urlArchivo(experiencia.emprendimiento.foto_url)
  const [fotoFallo, setFotoFallo] = useState(false)

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-campo-100 to-campo-50">
        {foto && !fotoFallo ? (
          <img
            src={foto}
            alt={`Foto de ${experiencia.emprendimiento.nombre}`}
            loading="lazy"
            onError={() => setFotoFallo(true)}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-campo-500">
            <Icono className="size-14" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-campo-700 shadow-sm backdrop-blur">
          <Icono className="size-3.5" aria-hidden />
          {nombreTipo}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold text-stone-800">{experiencia.titulo}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{experiencia.localidad}</span>
        </p>
        <Link
          to={`/emprendimientos/${experiencia.emprendimiento.id}`}
          className="mt-1 truncate text-sm font-medium text-campo-600 hover:underline"
        >
          {experiencia.emprendimiento.nombre}
        </Link>
        <p className="mt-auto pt-4 text-stone-800">
          <span className="text-lg font-bold text-campo-700">{formatearPrecio(experiencia.precio_por_persona)}</span>
          {experiencia.precio_por_persona > 0 && <span className="text-sm text-stone-500"> / persona</span>}
        </p>
      </div>
    </article>
  )
}
