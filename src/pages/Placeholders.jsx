import { Link } from 'react-router-dom'
import { Settings, CreditCard, TrendingDown, PieChart, Users, TrendingUp, Shield } from 'lucide-react'

export function Config() {
  return (
    <div>
      <h2 style={{ fontWeight:700, marginBottom:'1rem' }}>Configuración</h2>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {[
          { to:'/config/usuarios',  icon:Users,       label:'Gestión de usuarios'   },
          { to:'/cuentas/tarjetas', icon:CreditCard,  label:'Tarjetas de crédito'   },
          { to:'/prestamos',        icon:TrendingDown, label:'Préstamos'             },
          { to:'/presupuestos',     icon:PieChart,     label:'Presupuestos'          },
          { to:'/deudas',           icon:Users,        label:'Deudas internas'       },
          { to:'/ingresos',         icon:TrendingUp,   label:'Ingresos'              },
          { to:'/config/seguridad', icon:Shield,       label:'Seguridad (PIN)'       },
          { to:'/config/eliminados', icon: Trash2, label:'Elementos eliminados' },
        ].map(({ to, icon:Icon, label }, i) => (
          <Link key={to} to={to} style={{ display:'flex',alignItems:'center',gap:'1rem',textDecoration:'none',color:'var(--color-text,#1F2937)',padding:'1rem 1.25rem',borderTop:i>0?'1px solid #F3F4F6':'none' }}>
            <Icon size={20} color="#2E6DA4"/>
            <span style={{ fontWeight:600 }}>{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
