import { useState, useRef, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePrefs } from '../../context/PrefsContext'
import BottomNav from './BottomNav'
import SpeedDial from './SpeedDial'
import { LogOut, User, Shield, Eye, EyeOff } from 'lucide-react'

const TITLES = {
  '/':                 'Inicio',
  '/cuentas':          'Cuentas',
  '/cuentas/tarjetas': 'Tarjetas',
  '/gastos':           'Gastos',
  '/gastos/nuevo':     'Nuevo Gasto',
  '/ingresos':         'Ingresos',
  '/reportes':         'Reportes',
  '/prestamos':        'Préstamos',
  '/presupuestos':     'Presupuestos',
  '/deudas':           'Deudas',
  '/config':           'Configuración',
  '/config/usuarios':  'Usuarios',
  '/config/seguridad': 'Seguridad',
}

export default function AppLayout() {
  const { perfil, logout, isAdmin }          = useAuth()
  const { hideBalances, toggleHideBalances } = usePrefs()
  const location  = useLocation()
  const navigate  = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef   = useRef(null)

  const title    = TITLES[location.pathname] || 'FamilyFinance'
  const initials = perfil?.nombre
    ? perfil.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh',
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden',
      background: 'var(--color-bg, #F9FAFB)',
    }}>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        background: 'var(--color-header-bg, #fff)',
        borderBottom: '1px solid var(--color-border, #E5E7EB)',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}>
        {/* Logo and Title */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          minWidth: 0,
        }}>
          <span style={{
            background: 'linear-gradient(135deg, #1E3A5F, #2E6DA4)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
            borderRadius: 7,
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}>
            FF
          </span>
          <span style={{
            fontWeight: 700,
            fontSize: '1rem',
            color: 'var(--color-text, #1F2937)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </span>
        </div>

        {/* Right Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexShrink: 0,
        }}>
          {/* Hide/Show Balances Button */}
          <button
            onClick={toggleHideBalances}
            title={hideBalances ? 'Mostrar balances' : 'Ocultar balances'}
            style={{
              background: hideBalances ? '#EEF5FC' : 'var(--color-card-hover, #F3F4F6)',
              border: 'none',
              cursor: 'pointer',
              padding: '0.4rem 0.55rem',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              color: hideBalances ? '#2E6DA4' : 'var(--color-text-secondary, #6B7280)',
              transition: 'all 0.2s ease',
            }}
          >
            {hideBalances ? <EyeOff size={18} /> : <Eye size={18} />}
            <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
              {hideBalances ? 'Oculto' : 'Visible'}
            </span>
          </button>

          {/* Avatar + Menu */}
          <div style={{ position: 'relative', flexShrink: 0 }} ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                cursor: 'pointer',
                background: perfil?.avatar_color || '#2E6DA4',
                border: menuOpen ? '2px solid #2E6DA4' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.8rem',
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
            >
              {initials}
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 0.5rem)',
                right: 0,
                background: 'var(--color-card, #fff)',
                borderRadius: 14,
                minWidth: 200,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
                border: '1px solid var(--color-border, #E5E7EB)',
                overflow: 'hidden',
                zIndex: 200,
                animation: 'fadeInUp 0.2s ease-out',
              }}>
                {/* User Info */}
                <div style={{
                  padding: '0.9rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  borderBottom: '1px solid var(--color-border, #E5E7EB)',
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: perfil?.avatar_color || '#2E6DA4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: 'var(--color-text, #1F2937)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      margin: 0,
                    }}>
                      {perfil?.nombre || perfil?.email}
                    </p>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      marginTop: '0.25rem',
                    }}>
                      {isAdmin
                        ? <>
                            <Shield size={12} color="#7A4800" />
                            <span style={{
                              fontSize: '0.72rem',
                              color: '#7A4800',
                              fontWeight: 600,
                            }}>
                              Admin
                            </span>
                          </>
                        : <>
                            <User size={12} color="#2E6DA4" />
                            <span style={{
                              fontSize: '0.72rem',
                              color: '#2E6DA4',
                              fontWeight: 600,
                            }}>
                              Miembro
                            </span>
                          </>
                      }
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: '#DC2626',
                    fontWeight: 600,
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--color-card-hover, #F3F4F6)'}
                  onMouseLeave={(e) => e.target.style.background = 'none'}
                >
                  <LogOut size={17} color="#DC2626" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: '1rem',
        paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        maxWidth: 600,
        margin: '0 auto',
        width: '100%',
        minWidth: 0,
        overflowX: 'hidden',
      }}>
        <Outlet />
      </main>

      {/* Speed Dial — acceso rápido a Gasto, Ingreso, Transferencia, Pago tarjeta */}
      <SpeedDial />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
