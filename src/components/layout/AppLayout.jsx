import { useState, useRef, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BottomNav from './BottomNav'
import { LogOut, User, Shield } from 'lucide-react'

const TITLES = {
  '/':                  'Inicio',
  '/cuentas':           'Cuentas',
  '/cuentas/tarjetas':  'Tarjetas de crédito',
  '/gastos':            'Gastos',
  '/gastos/nuevo':      'Nuevo Gasto',
  '/reportes':          'Reportes',
  '/config':            'Configuración',
  '/config/usuarios':   'Usuarios',
}

export default function AppLayout() {
  const { perfil, logout, isAdmin } = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const title = TITLES[location.pathname] || 'FamilyFinance'

  const initials = perfil?.nombre
    ? perfil.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [])

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div style={S.root}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.appTag}>FF</span>
          <span style={S.pageTitle}>{title}</span>
        </div>

        {/* Avatar con menú */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              ...S.avatar,
              background: perfil?.avatar_color || '#2E6DA4',
              border: menuOpen ? '2px solid #2E6DA4' : '2px solid transparent',
            }}
            aria-label="Menú de usuario"
          >
            {initials}
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div style={S.dropdown}>
              {/* Info usuario */}
              <div style={S.dropdownHeader}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: perfil?.avatar_color || '#2E6DA4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '.9rem',
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '.9rem', color: '#1F2937',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {perfil?.nombre || perfil?.email}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                    {isAdmin
                      ? <><Shield size={12} color="#7A4800" /><span style={{ fontSize: '.72rem', color: '#7A4800', fontWeight: 600 }}>Administrador</span></>
                      : <><User size={12} color="#2E6DA4" /><span style={{ fontSize: '.72rem', color: '#2E6DA4', fontWeight: 600 }}>Miembro</span></>
                    }
                  </div>
                </div>
              </div>

              <div style={S.dropdownDivider} />

              {/* Cerrar sesión */}
              <button onClick={handleLogout} style={S.dropdownItem}>
                <LogOut size={17} color="#DC2626" />
                <span style={{ color: '#DC2626', fontWeight: 600 }}>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Contenido */}
      <main style={S.main}>
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}

const S = {
  root: { display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#F9FAFB' },
  header: {
    position: 'sticky', top: 0, zIndex: 90, background: '#fff',
    borderBottom: '1px solid #E5E7EB', padding: '.75rem 1rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: '.65rem' },
  appTag: {
    background: 'linear-gradient(135deg, #1E3A5F, #2E6DA4)', color: '#fff',
    fontWeight: 800, fontSize: '.75rem', padding: '.25rem .5rem',
    borderRadius: 7, letterSpacing: '.05em',
  },
  pageTitle: { fontWeight: 700, fontSize: '1rem', color: '#1F2937' },
  avatar: {
    width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: '.8rem',
    outline: 'none', transition: 'border .15s',
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + .5rem)', right: 0,
    background: '#fff', borderRadius: 14, minWidth: 220,
    boxShadow: '0 8px 32px rgba(0,0,0,.15)', border: '1px solid #E5E7EB',
    overflow: 'hidden', zIndex: 200,
  },
  dropdownHeader: { padding: '.9rem 1rem', display: 'flex', alignItems: 'center', gap: '.75rem' },
  dropdownDivider: { height: 1, background: '#F3F4F6' },
  dropdownItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '.75rem',
    padding: '.85rem 1rem', background: 'none', border: 'none',
    cursor: 'pointer', fontSize: '.9rem', textAlign: 'left',
  },
  main: {
    flex: 1, padding: '1rem',
    paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
    maxWidth: 600, margin: '0 auto', width: '100%',
  },
}
