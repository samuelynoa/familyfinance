import { NavLink } from 'react-router-dom'
import { Home, CreditCard, ArrowUpCircle, BarChart2, Settings } from 'lucide-react'

const NAV = [
  { to: '/',         icon: Home,           label: 'Inicio' },
  { to: '/cuentas',  icon: CreditCard,     label: 'Cuentas' },
  { to: '/gastos/nuevo', icon: ArrowUpCircle, label: 'Registrar' },
  { to: '/reportes', icon: BarChart2,      label: 'Reportes' },
  { to: '/config',   icon: Settings,       label: 'Config' },
]

export default function BottomNav() {
  return (
    <nav style={styles.nav}>
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            ...styles.item,
            color: isActive ? '#2E6DA4' : '#9CA3AF',
          })}
        >
          {({ isActive }) => (
            <>
              <div style={{ ...styles.iconWrap, background: isActive ? '#EEF5FC' : 'transparent' }}>
                <Icon size={22} />
              </div>
              <span style={styles.label}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

const styles = {
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#fff',
    borderTop: '1px solid #E5E7EB',
    display: 'flex',
    padding: '.3rem 0 calc(.3rem + env(safe-area-inset-bottom))',
    zIndex: 100,
  },
  item: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '.15rem',
    textDecoration: 'none', fontSize: '.68rem', fontWeight: 600,
  },
  iconWrap: {
    width: 42, height: 32, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  label: { lineHeight: 1 },
}
