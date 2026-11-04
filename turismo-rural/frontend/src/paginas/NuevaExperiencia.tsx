import { ArrowLeft, CircleCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { misEmprendimientos, type Emprendimiento } from '../api/emprendimientos'
import { crearExperiencia, type Experiencia } from '../api/experiencias'
import ErrorCarga from '../components/ErrorCarga'
import ExperienciaForm from '../components/ExperienciaForm'
import { useCarga } from '../hooks/useCarga'

const SEGUNDOS_REDIRECCION = 2

export default function NuevaExperiencia() {
  const { datos: emprendimientos, error, cargando, recargar } = useCarga(misEmprendimientos, [])

  return (
    <section className="w-full max-w-2xl">
      <Link to="/mis-experiencias" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-campo-600 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Mis experiencias
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-campo-700">Publicar experiencia</h1>

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar tus emprendimientos" onReintentar={recargar} />
      ) : !emprendimientos ? (
        <p className="text-stone-500">Cargando…</p>
      ) : emprendimientos.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-stone-700">Primero necesitas un emprendimiento</p>
          <p className="mt-1 text-sm text-stone-500">Cada experiencia se publica dentro de uno de tus emprendimientos.</p>
          <Link
            to="/mis-emprendimientos"
            className="mt-4 inline-block rounded-lg bg-campo-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-campo-700"
          >
            Crear emprendimiento
          </Link>
        </div>
      ) : (
        <FormularioExperiencia emprendimientos={emprendimientos} />
      )}
    </section>
  )
}

function FormularioExperiencia({ emprendimientos }: { emprendimientos: Emprendimiento[] }) {
  const navigate = useNavigate()
  const [publicada, setPublicada] = useState<Experiencia | null>(null)

  // Tras publicar: confirmación breve y redirección a "Mis experiencias"
  useEffect(() => {
    if (!publicada) return
    const t = setTimeout(
      () => navigate('/mis-experiencias', { state: { nueva: publicada.id } }),
      SEGUNDOS_REDIRECCION * 1000,
    )
    return () => clearTimeout(t)
  }, [publicada, navigate])

  if (publicada) {
    return (
      <div role="status" className="flex flex-col items-center rounded-2xl bg-white p-10 text-center shadow-lg">
        <CircleCheck className="mb-3 size-14 text-campo-600" aria-hidden />
        <h2 className="text-2xl font-bold text-campo-700">¡Experiencia publicada!</h2>
        <p className="mt-2 text-stone-600">
          <span className="font-medium">{publicada.titulo}</span>{' '}
          {publicada.estado === 'activo' ? 'ya aparece en el catálogo.' : 'quedó guardada como pausada.'}
        </p>
        <p className="mt-4 text-sm text-stone-500">Te llevamos a Mis experiencias…</p>
        <Link
          to="/mis-experiencias"
          state={{ nueva: publicada.id }}
          className="mt-3 text-sm font-medium text-campo-600 hover:underline"
        >
          Ir ahora
        </Link>
      </div>
    )
  }

  return (
    <ExperienciaForm
      emprendimientos={emprendimientos}
      textoEnviar="Publicar"
      textoEnviando="Publicando…"
      onEnviar={async (datos) => setPublicada(await crearExperiencia(datos))}
    />
  )
}
