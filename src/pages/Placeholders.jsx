import { Link } from 'react-router-dom'
import { CreditCard, BarChart2, Settings, Construction } from 'lucide-react'

function Placeholder({ icon: Icon, title, description, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: '1rem',
      textAlign: 'center', padding: '2rem',
    }}>
      <div style={{
        background: color + '20', borderRadius: 20, width: 80, height: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={36} color={color}/>
      </div>
      <h2 style={{ fontWeight: 700, fontSize: '1.25rem', color: '#1F2937' }}>{title}</h2>
      <p style={{ color: '#9CA3AF', maxWidth: 280 }}>{description}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: '#2E6DA4', fontSize: '.875rem' }}>
        <Construction size={16}/> Próximamente — Fase 2
      </div>
    </div>
  )
}

export function Cuentas() {
  return <Placeholder icon={CreditCard} title="Cuentas" description="Gestiona tus cuentas bancarias, efectivo, ahorros e inversiones." color="#2E6DA4"/>
}

export function GastosLista() {
  return <Placeholder icon={CreditCard} title="Gastos" description="Historial completo de gastos por categoría, usuario y período." color="#DC2626"/>
}

export function NuevoGasto() {
  return <Placeholder icon={CreditCard} title="Nuevo Gasto" description="Registra un gasto manual o toma foto de una factura." color="#1B5E35"/>
}

export function Reportes() {
  return <Placeholder icon={BarChart2} title="Reportes" description="Dashboard con gráficas de gastos, ingresos y patrimonio." color="#7A4800"/>
}

export function Config() {
  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Configuración</h2>
      <div className="card">
        <Link to="/config/usuarios" style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          textDecoration: 'none', color: '#1F2937', padding: '.5rem 0',
        }}>
          <Settings size={20} color="#2E6DA4"/>
          <span style={{ fontWeight: 600 }}>Gestión de usuarios</span>
        </Link>
      </div>
    </div>
  )
}
