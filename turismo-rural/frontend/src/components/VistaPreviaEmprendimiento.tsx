import { MapPin, Phone, Store } from 'lucide-react'
import { REDES_INFO } from '../redes'
import { CAMPOS_REDES, enlaceRed, type CampoRed } from '../validacion'

type Props = {
  nombre: string
  localidad: string
  direccion: string
  telefono: string
  descripcion: string
  historia: string
  /** Solo redes válidas y normalizadas */
  redes: Partial<Record<CampoRed, string>>
  fotoUrl: string | null
}

function Vacio({ children }: { children: string }) {
  return <span className="text-stone-400 italic">{children}</span>
}

/** Ficha del emprendimiento tal como la verán los visitantes. */
export default function VistaPreviaEmprendimiento(p: Props) {
  const redes = CAMPOS_REDES.filter((red) => p.redes[red])

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-lg">
      <div className="aspect-[16/9] bg-gradient-to-br from-campo-100 to-campo-50">
        {p.fotoUrl ? (
          <img src={p.fotoUrl} alt={`Foto de ${p.nombre || 'tu emprendimiento'}`} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-campo-500">
            <Store className="size-12" strokeWidth={1.5} aria-hidden />
            <span className="text-sm">Sin foto de perfil</span>
          </div>
        )}
      </div>

      <div className="space-y-5 p-6">
        <header>
          <h2 className="text-2xl font-bold break-words text-stone-800">{p.nombre.trim() || <Vacio>Nombre del emprendimiento</Vacio>}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {p.localidad.trim() || <Vacio>Localidad</Vacio>}
          </p>
        </header>

        <section>
          <h3 className="mb-1 text-sm font-semibold tracking-wide text-campo-700 uppercase">Sobre nosotros</h3>
          <p className="break-words whitespace-pre-line text-stone-700">
            {p.descripcion.trim() || <Vacio>Agrega una descripción para que los visitantes te conozcan.</Vacio>}
          </p>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold tracking-wide text-campo-700 uppercase">Nuestra historia</h3>
          <p className="break-words whitespace-pre-line text-stone-700">
            {p.historia.trim() || <Vacio>Cuenta cómo nació tu emprendimiento.</Vacio>}
          </p>
        </section>

        <section className="border-t border-stone-100 pt-4">
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-campo-700 uppercase">Contacto</h3>
          <ul className="space-y-1 text-sm text-stone-700">
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-stone-400" aria-hidden />
              {p.telefono.trim() || <Vacio>Teléfono de contacto</Vacio>}
            </li>
            {p.direccion.trim() && (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-stone-400" aria-hidden />
                <span className="break-words">{p.direccion}</span>
              </li>
            )}
          </ul>
          {redes.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {redes.map((red) => {
                const { nombre, Icono } = REDES_INFO[red]
                return (
                  <li key={red}>
                    <a
                      href={enlaceRed(red, p.redes[red]!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-campo-50 px-3 py-1.5 text-sm font-medium text-campo-700 transition hover:bg-campo-100"
                    >
                      <Icono className="size-4" aria-hidden />
                      {nombre}
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </article>
  )
}
