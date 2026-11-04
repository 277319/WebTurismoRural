import { Link, Route, Routes } from 'react-router'
import { useAuth } from './auth/contexto'
import Layout from './components/Layout'
import RutaProtegida from './components/RutaProtegida'
import { Ingresar, Registro } from './paginas/Acceso'
import Catalogo from './paginas/Catalogo'
import EditarEmprendimiento from './paginas/EditarEmprendimiento'
import EditarExperiencia from './paginas/EditarExperiencia'
import GaleriaExperiencia from './paginas/GaleriaExperiencia'
import MiCuenta from './paginas/MiCuenta'
import MisEmprendimientos from './paginas/MisEmprendimientos'
import MisExperiencias from './paginas/MisExperiencias'
import NuevaExperiencia from './paginas/NuevaExperiencia'
import PaginaEmprendimiento from './paginas/PaginaEmprendimiento'
import PersonalizarEmprendimiento from './paginas/PersonalizarEmprendimiento'

function App() {
  const { cargando } = useAuth()

  // Mientras se valida el token guardado, evitamos redirigir a /ingresar por error
  if (cargando) {
    return <div className="flex min-h-screen items-center justify-center bg-campo-50 text-stone-500">Cargando…</div>
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
        <Route
          path="experiencias/:id/editar"
          element={
            <RutaProtegida rol="anfitrion">
              <EditarExperiencia />
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
              <h1 className="text-2xl font-bold text-campo-700">Página no encontrada</h1>
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
