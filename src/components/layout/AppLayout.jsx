import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BottomNav from './BottomNav'
import { Bell } from 'lucide-react'

const TITLES = {
  '/':              'Inicio',
  '/cuentas':       'Cuentas',
  '/gastos':        'Gastos',
  '/gastos/nuevo':  'Nuevo Gasto',
  '/reportes':      'Reportes',
  '/config':        'Configuración',
  '/config/usuarios': 'Usuarios',
}

export default function AppLayout() {
  const { perfil } = useAuth()
  const location   = useLocation()
  const title      = TITLES[location.pathname] || 'FamilyFinance'

  const initials = perfil?.nombre
    ? perfil.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div style={styles.root}>
      {/* Top header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.appTag}>FF</span>
          <span style={styles.pageTitle}>{title}</span>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.iconBtn} aria-label="Notificaciones">
            <Bell size={20} color="#4B5563" />
          </button>
          <div
            style={{
              ...styles.avatar,
              background: perfil?.avatar_color || '#2E6DA4',
            }}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main style={styles.main}>
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}

const styles = {
  root:  { display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#F9FAFB' },
  header: {
    position: 'sticky', top: 0, zIndex: 90,
    background: '#fff',
    borderBottom: '1px solid #E5E7EB',
    padding: '.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: '.65rem' },
  appTag: {
    background: 'linear-gradient(135deg, #1E3A5F, #2E6DA4)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '.75rem',
    padding: '.25rem .5rem',
    borderRadius: 7,
    letterSpacing: '.05em',
  },
  pageTitle: { fontWeight: 700, fontSize: '1rem', color: '#1F2937' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '.75rem' },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '.35rem', borderRadius: 8, display: 'flex',
  },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: '.8rem',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    padding: '1rem',
    paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
    maxWidth: 600,
    margin: '0 auto',
    width: '100%',
  },
}
