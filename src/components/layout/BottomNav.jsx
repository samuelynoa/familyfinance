import { useLocation, Link } from 'react-router-dom'
import { Home, Wallet, TrendingUp, BarChart3, Settings } from 'lucide-react'

const NAVS = [
  { path: '/',           label: 'Inicio',       icon: Home },
  { path: '/cuentas',    label: 'Cuentas',      icon: Wallet },
  { path: '/gastos',     label: 'Gastos',       icon: TrendingUp },
  { path: '/reportes',   label: 'Reportes',     icon: BarChart3 },
  { path: '/config',     label: 'Config',       icon: Settings },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--color-nav-bg, #fff)',
        borderTop: '1px solid var(--color-border, #E5E7EB)',
        zIndex: 85,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: '4.5rem',
          width: '100%',
        }}
      >
        {NAVS.map(nav => {
          const Icon = nav.icon
          const isActive = location.pathname === nav.path || location.pathname.startsWith(nav.path + '/')
          
          return (
            <Link
              key={nav.path}
              to={nav.path}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                flex: 1,
                padding: '0.5rem',
                color: isActive ? '#2E6DA4' : 'var(--color-text-secondary, #6B7280)',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
              }}
            >
              <Icon size={24} />
              <span style={{ fontSize: '0.65rem', fontWeight: 600, textAlign: 'center' }}>
                {nav.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
