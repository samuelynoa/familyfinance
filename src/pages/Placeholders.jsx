import { Link } from 'react-router-dom'
import { BarChart2, Settings, Construction, CreditCard } from 'lucide-react'

function Placeholder({ icon: Icon, title, description, color }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', minHeight:'50vh', gap:'1rem', textAlign:'center', padding:'2rem' }}>
      <div style={{ background: color+'20', borderRadius:20, width:80, height:80,
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={36} color={color} />
      </div>
      <h2 style={{ fontWeight:700, fontSize:'1.25rem' }}>{title}</h2>
      <p style={{ color:'#9CA3AF', maxWidth:280 }}>{description}</p>
      <div style={{ display:'flex', alignItems:'center', gap:'.5rem', color:'#2E6DA4', fontSize:'.875rem' }}>
        <Construction size={16} /> Próximamente — Fase 4/5
      </div>
    </div>
  )
}

export function Reportes() {
  return <Placeholder icon={BarChart2} title="Reportes" description="Dashboard con gráficas de gastos, ingresos y patrimonio. Disponible en Fase 5." color="#7A4800" />
}

export function Config() {
  return (
    <div>
      <h2 style={{ fontWeight:700, marginBottom:'1rem' }}>Configuración</h2>
      <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:'.75rem' }}>
        <Link to="/config/usuarios" style={S.menuItem}>
          <Settings size={20} color="#2E6DA4" />
          <span style={{ fontWeight:600 }}>Gestión de usuarios</span>
        </Link>
        <Link to="/cuentas/tarjetas" style={{ ...S.menuItem, borderTop:'1px solid #F3F4F6' }}>
          <CreditCard size={20} color="#2E6DA4" />
          <span style={{ fontWeight:600 }}>Tarjetas de crédito</span>
        </Link>
      </div>
      <Placeholder icon={Settings} title="Más opciones" description="Presupuestos, préstamos y alertas — disponibles en Fase 4." color="#9CA3AF" />
    </div>
  )
}

const S = {
  menuItem: { display:'flex', alignItems:'center', gap:'1rem', textDecoration:'none',
    color:'#1F2937', padding:'1rem 1.25rem' },
}
