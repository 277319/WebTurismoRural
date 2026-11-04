import { ArrowLeft, CircleCheck, Images } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorApi } from '../api/cliente'
import { misEmprendimientos, type Emprendimiento } from '../api/emprendimientos'
import { editarExperiencia, misExperiencias, type Experiencia } from '../api/experiencias'
import ErrorCarga from '../components/ErrorCarga'
import ExperienciaForm from '../components/ExperienciaForm'
import { useCarga } from '../hooks/useCarga'

export default function EditarExperiencia() {
  const { id } = useParams()
  const experienciaId = Number(id)
  const { datos, error, cargando, recargar, setDatos } = useCarga(async () => {
    // Los emprendimientos hacen falta para poder mover la experiencia a otro de ellos
    const [experiencias, emprendimientos] = await Promise.all([misExperiencias(), misEmprendimientos()])
    const experiencia = experiencias.find((e) => e.id === experienciaId)
    if (!experiencia) throw new ErrorApi('No encontramos esta experiencia entre las tuyas.', null, 404)
    return { experiencia, emprendimientos }
  }, [experienciaId])

  return (
    <section className="w-full max-w-2xl">
      <Link to="/mis-experiencias" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-campo-600 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Mis experiencias
      </Link>

      {error && !cargando ? (
        <ErrorCarga error={error} titulo="No pudimos cargar la experiencia" onReintentar={recargar} />
      ) : !datos ? (
        <p className="text-stone-500">Cargando…</p>
      ) : (
        <FormularioEdicion
          key={datos.experiencia.id}
          experiencia={datos.experiencia}
          emprendimientos={datos.emprendimientos}
          onGuardada={(experiencia) => setDatos((d) => ({ emprendimientos: d?.emprendimientos ?? [], experiencia }))}
        />
      )}
    </section>
  )
}

function FormularioEdicion({
  experiencia,
  emprendimientos,
  onGuardada,
}: {
  experiencia: Experiencia
  emprendimientos: Emprendimiento[]
  onGuardada: (e: Experiencia) => void
}) {
  const [guardado, setGuardado] = useState(false)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-campo-700">Editar experiencia</h1>
          <p className="mt-0.5 truncate text-stone-600">{experiencia.titulo}</p>
        </div>
        <Link
          to={`/experiencias/${experiencia.id}/galeria`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          <Images className="size-4" aria-hidden />
          Galería de fotos
        </Link>
      </div>

      <ExperienciaForm
        emprendimientos={emprendimientos}
        experiencia={experiencia}
        textoEnviar="Guardar cambios"
        textoEnviando="Guardando…"
        onCambio={() => setGuardado(false)}
        onEnviar={async (datos) => {
          onGuardada(await editarExperiencia(experiencia.id, datos))
          setGuardado(true)
        }}
        aviso={
          guardado && (
            <p role="status" className="flex items-center gap-2 rounded-lg bg-campo-50 px-3 py-2 text-sm text-campo-700">
              <CircleCheck className="size-4" aria-hidden />
              Cambios guardados.
            </p>
          )
        }
      />
    </>
  )
}
