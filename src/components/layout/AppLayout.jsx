import { useState, useRef, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePrefs } from '../../context/PrefsContext'
import BottomNav from './BottomNav'
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
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100dvh', width:'100%', overflowX:'hidden', background:'var(--color-bg, #F9FAFB)' }}>

      <header style={{
        position:'sticky', top:0, zIndex:90,
        background: 'var(--color-header-bg, #fff)',
        borderBottom: '1px solid var(--color-border, #E5E7EB)',
        padding:'.75rem 1rem',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
          <span style={{ background:'linear-gradient(135deg,#1E3A5F,#2E6DA4)', color:'#fff', fontWeight:800, fontSize:'.75rem', padding:'.25rem .5rem', borderRadius:7, letterSpacing:'.05em' }}>FF</span>
          <span style={{ fontWeight:700, fontSize:'1rem', color:'var(--color-text, #1F2937)' }}>{title}</span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
          {/* Hide/show balances */}
          <button
            onClick={toggleHideBalances}
            title={hideBalances ? 'Mostrar balances' : 'Ocultar balances'}
            style={{
              background: hideBalances ? '#EEF5FC' : 'var(--color-card-hover, #F3F4F6)',
              border:'none', cursor:'pointer', padding:'.4rem .55rem',
              borderRadius:8, display:'flex', alignItems:'center', gap:'.3rem',
              color: hideBalances ? '#2E6DA4' : 'var(--color-text-secondary, #6B7280)',
            }}>
            {hideBalances ? <EyeOff size={18}/> : <Eye size={18}/>}
            <span style={{ fontSize:'.72rem', fontWeight:600 }}>
              {hideBalances ? 'Oculto' : 'Visible'}
            </span>
          </button>

          {/* Avatar + menú */}
          <div style={{ position:'relative' }} ref={menuRef}>
            <button onClick={() => setMenuOpen(v => !v)} style={{
              width:36, height:36, borderRadius:'50%', cursor:'pointer',
              background: perfil?.avatar_color || '#2E6DA4',
              border: menuOpen ? '2px solid #2E6DA4' : '2px solid transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#fff', fontWeight:700, fontSize:'.8rem', outline:'none',
            }}>
              {initials}
            </button>

            {menuOpen && (
              <div style={{
                position:'absolute', top:'calc(100% + .5rem)', right:0,
                background: 'var(--color-card, #fff)',
                borderRadius:14, minWidth:200,
                boxShadow:'0 8px 32px rgba(0,0,0,.18)',
                border: '1px solid var(--color-border, #E5E7EB)',
                overflow:'hidden', zIndex:200,
              }}>
                {/* Info usuario */}
                <div style={{ padding:'.9rem 1rem', display:'flex', alignItems:'center', gap:'.75rem' }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background: perfil?.avatar_color||'#2E6DA4', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:'.9rem', flexShrink:0 }}>
                    {initials}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:700, fontSize:'.9rem', color:'var(--color-text,#1F2937)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {perfil?.nombre || perfil?.email}
                    </p>
                    <div style={{ display:'flex', alignItems:'center', gap:'.3rem' }}>
                      {isAdmin
                        ? <><Shield size={12} color="#7A4800"/><span style={{ fontSize:'.72rem', color:'#7A4800', fontWeight:600 }}>Admin</span></>
                        : <><User   size={12} color="#2E6DA4"/><span style={{ fontSize:'.72rem', color:'#2E6DA4', fontWeight:600 }}>Miembro</span></>
                      }
                    </div>
                  </div>
                </div>

                <div style={{ height:1, background:'var(--color-border,#F3F4F6)' }}/>

                {/* Cerrar sesión */}
                <button onClick={handleLogout} style={{
                  width:'100%', display:'flex', alignItems:'center', gap:'.75rem',
                  padding:'.85rem 1rem', background:'none', border:'none',
                  cursor:'pointer', fontSize:'.9rem', color:'#DC2626',
                }}>
                  <LogOut size={17} color="#DC2626"/>
                  <span style={{ fontWeight:600 }}>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ flex:1, padding:'1rem', paddingBottom:'calc(5rem + env(safe-area-inset-bottom))', maxWidth:600, margin:'0 auto', width:'100%', minWidth:0, overflowX:'hidden' }}>
        <Outlet/>
      </main>

      <BottomNav/>
    </div>
  )
}
