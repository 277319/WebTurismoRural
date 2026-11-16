import { HeartHandshake, MapPin, Phone, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { BLOQUES_INFO, TIPOS_BLOQUE, variablesTema, type DatosFicha } from '../fichaEmprendimiento'
import { REDES_INFO } from '../redes'
import { CAMPOS_REDES, enlaceRed } from '../validacion'

type Props = {
  datos: DatosFicha
  /** Vista previa del anfitrión: muestra textos de ejemplo donde falta contenido */
  previa?: boolean
}

function Vacio({ children }: { children: string }) {
  return <span className="text-stone-500 italic">{children}</span>
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold tracking-wide text-(--marca-tinta) uppercase">{titulo}</h3>
      <p className="break-words whitespace-pre-line text-stone-700">{children}</p>
    </section>
  )
}

/**
 * Página pública del emprendimiento, con los colores elegidos por el anfitrión aplicados
 * como variables CSS (ver `variablesTema`). Se adapta al ancho de su contenedor, no de la pantalla.
 */
export default function FichaEmprendimiento({ datos: d, previa = false }: Props) {
  const redes = CAMPOS_REDES.filter((red) => d.redes[red])
  const bloques = TIPOS_BLOQUE.filter((tipo) => d.bloques[tipo].activo && (previa || d.bloques[tipo].contenido?.trim()))
  const Titulo = previa ? 'h2' : 'h1'

  return (
    <article style={variablesTema(d.colorPrimario, d.colorSecundario)} className="@container overflow-hidden rounded-2xl bg-white shadow-lg">
      <div className="aspect-[16/9] bg-linear-to-br from-(--marca) to-(--marca-2) @2xl:aspect-[3/1]">
        {d.portadaUrl && <img src={d.portadaUrl} alt={`Portada de ${d.nombre || 'tu emprendimiento'}`} className="size-full object-cover" />}
      </div>

      <div className="px-6 pb-6">
        <header className="-mt-10 flex flex-col gap-3 @md:flex-row @md:items-end @md:gap-4">
          <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-(--marca-suave) text-(--marca-tinta) shadow-md @md:size-24">
            {d.fotoUrl ? (
              <img src={d.fotoUrl} alt={`Foto de ${d.nombre || 'tu emprendimiento'}`} className="size-full object-cover" />
            ) : (
              <Store className="size-9" strokeWidth={1.5} aria-hidden />
            )}
          </div>
          <div className="min-w-0 @md:pb-1">
            <Titulo className="text-2xl font-bold break-words text-stone-800">
              {d.nombre.trim() || <Vacio>Nombre del emprendimiento</Vacio>}
            </Titulo>
            <p className="mt-1 flex items-center gap-1 text-sm text-stone-600">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {d.localidad.trim() || <Vacio>Localidad</Vacio>}
            </p>
          </div>
        </header>

        <div className="mt-6 space-y-6">
          {(previa || d.descripcion.trim()) && (
            <Seccion titulo="Sobre nosotros">
              {d.descripcion.trim() || <Vacio>Agrega una descripción para que los visitantes te conozcan.</Vacio>}
            </Seccion>
          )}

          {(previa || d.historia.trim()) && (
            <Seccion titulo="Nuestra historia">
              {d.historia.trim() || <Vacio>Cuenta cómo nació tu emprendimiento.</Vacio>}
            </Seccion>
          )}

          {(previa || d.relatoComunidad.trim()) && (
            <section className="rounded-xl border-l-4 border-(--marca-2) bg-(--marca-suave) p-4">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-wide text-(--marca-tinta) uppercase">
                <HeartHandshake className="size-4" aria-hidden />
                Relato de la comunidad
              </h3>
              <p className="break-words whitespace-pre-line text-stone-700">
                {d.relatoComunidad.trim() || <Vacio>Cuenta qué hace única a tu comunidad: su gente, oficios y tradiciones.</Vacio>}
              </p>
            </section>
          )}

          {bloques.length > 0 && (
            <div className="grid gap-4 @lg:grid-cols-2">
              {bloques.map((tipo) => {
                const { titulo, Icono } = BLOQUES_INFO[tipo]
                const contenido = d.bloques[tipo].contenido?.trim()
                return (
                  <section key={tipo} className="rounded-xl border border-stone-200 p-4">
                    <h3 className="mb-2 flex items-center gap-2 font-semibold text-stone-800">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--marca-2) text-(--marca-2-texto)">
                        <Icono className="size-4" aria-hidden />
                      </span>
                      {titulo}
                    </h3>
                    <p className="text-sm break-words whitespace-pre-line text-stone-700">
                      {contenido || <Vacio>Escribe el contenido de este bloque.</Vacio>}
                    </p>
                  </section>
                )
              })}
            </div>
          )}

          <section className="border-t border-stone-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold tracking-wide text-(--marca-tinta) uppercase">Contacto</h3>
            <ul className="space-y-1 text-sm text-stone-700">
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-stone-500" aria-hidden />
                {d.telefono.trim() ? (
                  <a href={`tel:${d.telefono}`} className="hover:underline">
                    {d.telefono}
                  </a>
                ) : (
                  <Vacio>Teléfono de contacto</Vacio>
                )}
              </li>
              {d.direccion.trim() && (
                <li className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-stone-500" aria-hidden />
                  <span className="break-words">{d.direccion}</span>
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
                        href={enlaceRed(red, d.redes[red]!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-(--marca-suave) px-3 py-1.5 text-sm font-medium text-(--marca-tinta) transition hover:bg-(--marca) hover:text-(--marca-texto)"
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
      </div>
    </article>
  )
}
