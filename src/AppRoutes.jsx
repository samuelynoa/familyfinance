import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'
import Cuentas from './pages/Cuentas'
import Tarjetas from './pages/Tarjetas'
import NuevoGasto from './pages/NuevoGasto'
import GastosLista from './pages/GastosLista'
import Prestamos from './pages/Prestamos'
import Presupuestos from './pages/Presupuestos'
import DeudasInternas from './pages/DeudasInternas'
import Ingresos from './pages/Ingresos'
import Reportes from './pages/Reportes'
import ConfigPin from './pages/ConfigPin'
import { Config } from './pages/Placeholders'

function RequireAuth({ children }) {
  const { firebaseUser, loading } = useAuth()
  if (loading) return <div className="spinner-center"><div className="spinner"/></div>
  if (!firebaseUser) return <Navigate to="/login" replace/>
  return children
}
function PublicOnly({ children }) {
  const { firebaseUser, loading } = useAuth()
  if (loading) return <div className="spinner-center"><div className="spinner"/></div>
  if (firebaseUser) return <Navigate to="/" replace/>
  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"          element={<PublicOnly><Login/></PublicOnly>}/>
      <Route path="/reset-password" element={<PublicOnly><ResetPassword/></PublicOnly>}/>
      <Route path="/" element={<RequireAuth><AppLayout/></RequireAuth>}>
        <Route index                    element={<Dashboard/>}/>
        <Route path="cuentas"           element={<Cuentas/>}/>
        <Route path="cuentas/tarjetas"  element={<Tarjetas/>}/>
        <Route path="gastos"            element={<GastosLista/>}/>
        <Route path="gastos/nuevo"      element={<NuevoGasto/>}/>
        <Route path="ingresos"          element={<Ingresos/>}/>
        <Route path="reportes"          element={<Reportes/>}/>
        <Route path="prestamos"         element={<Prestamos/>}/>
        <Route path="presupuestos"      element={<Presupuestos/>}/>
        <Route path="deudas"            element={<DeudasInternas/>}/>
        <Route path="config"            element={<Config/>}/>
        <Route path="config/usuarios"   element={<Usuarios/>}/>
        <Route path="config/seguridad"  element={<ConfigPin/>}/>
      </Route>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  )
}
