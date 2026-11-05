import { lazy } from 'react'
import { Link, Route, Routes } from 'react-router'
import { useAuth } from './auth/contexto'
import Layout from './components/Layout'
import RutaProtegida from './components/RutaProtegida'
import Catalogo from './paginas/Catalogo'

// Cada página se descarga recién al abrirla: con mala conexión, la portada carga mucho antes.
// Mientras tanto el menú sigue a la vista y Layout muestra "Cargando la página…"
const Ingresar = lazy(() => import('./paginas/Acceso').then((m) => ({ default: m.Ingresar })))
const Registro = lazy(() => import('./paginas/Acceso').then((m) => ({ default: m.Registro })))
const DetalleExperiencia = lazy(() => import('./paginas/DetalleExperiencia'))
const DisponibilidadExperiencia = lazy(() => import('./paginas/DisponibilidadExperiencia'))
const EditarEmprendimiento = lazy(() => import('./paginas/EditarEmprendimiento'))
const EditarExperiencia = lazy(() => import('./paginas/EditarExperiencia'))
const GaleriaExperiencia = lazy(() => import('./paginas/GaleriaExperiencia'))
const MiCuenta = lazy(() => import('./paginas/MiCuenta'))
const MisEmprendimientos = lazy(() => import('./paginas/MisEmprendimientos'))
const MisExperiencias = lazy(() => import('./paginas/MisExperiencias'))
const MisReservas = lazy(() => import('./paginas/MisReservas'))
const NuevaExperiencia = lazy(() => import('./paginas/NuevaExperiencia'))
const PagoSimulado = lazy(() => import('./paginas/PagoSimulado'))
const PaginaEmprendimiento = lazy(() => import('./paginas/PaginaEmprendimiento'))
const PersonalizarEmprendimiento = lazy(() => import('./paginas/PersonalizarEmprendimiento'))
const ReservasExperiencia = lazy(() => import('./paginas/ReservasExperiencia'))
const ResultadoPago = lazy(() => import('./paginas/ResultadoPago'))

function App() {
  const { cargando } = useAuth()

  // Mientras se valida el token guardado, evitamos redirigir a /ingresar por error
  if (cargando) {
    return <div className="flex min-h-screen items-center justify-center bg-campo-50 text-stone-600">Cargando…</div>
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Catalogo />} />
        <Route path="ingresar" element={<Ingresar />} />
        <Route path="registro" element={<Registro />} />
        <Route
          path="mi-cuenta"
          element={
            <RutaProtegida>
              <MiCuenta />
            </RutaProtegida>
          }
        />
        <Route
          path="mis-reservas"
          element={
            <RutaProtegida>
              <MisReservas />
            </RutaProtegida>
          }
        />
        <Route
          path="pagos/:id/simulado"
          element={
            <RutaProtegida>
              <PagoSimulado />
            </RutaProtegida>
          }
        />
        <Route
          path="pagos/:id/exito"
          element={
            <RutaProtegida>
              <ResultadoPago key="exito" resultado="exito" />
            </RutaProtegida>
          }
        />
        <Route
          path="pagos/:id/fallo"
          element={
            <RutaProtegida>
              <ResultadoPago key="fallo" resultado="fallo" />
            </RutaProtegida>
          }
        />
        <Route
          path="mis-emprendimientos"
          element={
            <RutaProtegida rol="anfitrion">
              <MisEmprendimientos />
            </RutaProtegida>
          }
        />
        <Route path="emprendimientos/:id" element={<PaginaEmprendimiento />} />
        <Route
          path="emprendimientos/:id/personalizar"
          element={
            <RutaProtegida rol="anfitrion">
              <PersonalizarEmprendimiento />
            </RutaProtegida>
          }
        />
        <Route
          path="emprendimientos/:id/editar"
          element={
            <RutaProtegida rol="anfitrion">
              <EditarEmprendimiento />
            </RutaProtegida>
          }
        />
        <Route
          path="mis-experiencias"
          element={
            <RutaProtegida rol="anfitrion">
              <MisExperiencias />
            </RutaProtegida>
          }
        />
        <Route
          path="experiencias/nueva"
          element={
            <RutaProtegida rol="anfitrion">
              <NuevaExperiencia />
            </RutaProtegida>
          }
        />
        <Route path="experiencias/:id" element={<DetalleExperiencia />} />
        <Route
          path="experiencias/:id/editar"
          element={
            <RutaProtegida rol="anfitrion">
              <EditarExperiencia />
            </RutaProtegida>
          }
        />
        <Route
          path="experiencias/:id/disponibilidad"
          element={
            <RutaProtegida rol="anfitrion">
              <DisponibilidadExperiencia />
            </RutaProtegida>
          }
        />
        <Route
          path="experiencias/:id/reservas"
          element={
            <RutaProtegida rol="anfitrion">
              <ReservasExperiencia />
            </RutaProtegida>
          }
        />
        <Route
          path="experiencias/:id/galeria"
          element={
            <RutaProtegida rol="anfitrion">
              <GaleriaExperiencia />
            </RutaProtegida>
          }
        />
        <Route
          path="*"
          element={
            <div className="text-center">
              <h1 className="text-3xl font-bold text-campo-700">Página no encontrada</h1>
              <p className="mt-2 text-stone-600">La dirección que buscas no existe.</p>
              <Link to="/" className="mt-4 inline-block font-medium text-campo-600 hover:underline">
                Volver al catálogo
              </Link>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
