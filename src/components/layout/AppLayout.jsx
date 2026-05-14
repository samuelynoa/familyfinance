import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BottomNav from './BottomNav'

const TITLES = {
  '/': 'Inicio', '/cuentas': 'Cuentas', '/gastos': 'Gastos',
  '/gastos/nuevo': 'Nuevo Gasto', '/reportes': 'Reportes',
  '/config': 'Configuración', '/config/usuarios': 'Usuarios',
}

export default function AppLayout() {
  const { perfil }  = useAuth()
  const location    = useLocation()
  const title       = TITLES[location.pathname] || 'FamilyFinance'
  const initials    = perfil?.nombre ? perfil.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100dvh', background:'#F9FAFB' }}>
      <header style={{ position:'sticky', top:0, zIndex:90, background:'#fff', borderBottom:'1px solid #E5E7EB', padding:'.75rem 1rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
          <span style={{ background:'linear-gradient(135deg,#1E3A5F,#2E6DA4)', color:'#fff', fontWeight:800, fontSize:'.75rem', padding:'.25rem .5rem', borderRadius:7 }}>FF</span>
          <span style={{ fontWeight:700, fontSize:'1rem', color:'#1F2937' }}>{title}</span>
        </div>
        <div style={{ width:34, height:34, borderRadius:'50%', background: perfil?.avatar_color || '#2E6DA4', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:'.8rem' }}>
          {initials}
        </div>
      </header>
      <main style={{ flex:1, padding:'1rem', paddingBottom:'calc(5rem + env(safe-area-inset-bottom))', maxWidth:600, margin:'0 auto', width:'100%' }}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
