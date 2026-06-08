import { useState, useRef, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePrefs } from '../../context/PrefsContext'
import BottomNav from './BottomNav'
import { LogOut, User, Shield, Eye, EyeOff, Sun, Moon, Monitor } from 'lucide-react'

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
  const { perfil, logout, isAdmin }           = useAuth()
  const { hideBalances, toggleHideBalances,
          theme, setTheme, isDark }            = usePrefs()
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
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [])

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  const THEMES = [
    { v:'light',  icon:<Sun  size={15}/>, label:'Claro'   },
    { v:'dark',   icon:<Moon size={15}/>, label:'Oscuro'  },
    { v:'system', icon:<Monitor size={15}/>, label:'Auto' },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100dvh', background:'var(--gray-50,#F9FAFB)' }}>

      {/* Header */}
      <header style={{
        position:'sticky', top:0, zIndex:90,
        background: isDark?'#1E293B':'#fff',
        borderBottom: `1px solid ${isDark?'#334155':'#E5E7EB'}`,
        padding:'.75rem 1rem',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
          <span style={{ background:'linear-gradient(135deg,#1E3A5F,#2E6DA4)', color:'#fff', fontWeight:800, fontSize:'.75rem', padding:'.25rem .5rem', borderRadius:7, letterSpacing:'.05em' }}>FF</span>
          <span style={{ fontWeight:700, fontSize:'1rem', color: isDark?'#F1F5F9':'#1F2937' }}>{title}</span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
          {/* Toggle hide balances */}
          <button onClick={toggleHideBalances}
            style={{ background:'none', border:'none', cursor:'pointer', padding:'.35rem', borderRadius:8, color: isDark?'#94A3B8':'#4B5563', display:'flex' }}
            title={hideBalances ? 'Mostrar balances' : 'Ocultar balances'}>
            {hideBalances ? <Eye size={20}/> : <EyeOff size={20}/>}
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
                background: isDark?'#1E293B':'#fff',
                borderRadius:14, minWidth:220,
                boxShadow:'0 8px 32px rgba(0,0,0,.2)',
                border: `1px solid ${isDark?'#334155':'#E5E7EB'}`,
                overflow:'hidden', zIndex:200,
              }}>
                {/* Usuario */}
                <div style={{ padding:'.9rem 1rem', display:'flex', alignItems:'center', gap:'.75rem' }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background: perfil?.avatar_color||'#2E6DA4', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:'.9rem', flexShrink:0 }}>
                    {initials}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:700, fontSize:'.9rem', color: isDark?'#F1F5F9':'#1F2937', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
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

                <div style={{ height:1, background: isDark?'#334155':'#F3F4F6' }}/>

                {/* Selector de tema */}
                <div style={{ padding:'.75rem 1rem' }}>
                  <p style={{ fontSize:'.72rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'.5rem' }}>Tema</p>
                  <div style={{ display:'flex', gap:'.4rem' }}>
                    {THEMES.map(t => (
                      <button key={t.v} onClick={() => setTheme(t.v)} style={{
                        flex:1, padding:'.45rem .3rem', borderRadius:9, border:'1.5px solid', cursor:'pointer',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:'.2rem',
                        fontSize:'.68rem', fontWeight: theme===t.v ? 700 : 500,
                        borderColor: theme===t.v ? '#2E6DA4' : isDark?'#334155':'#E5E7EB',
                        background:  theme===t.v ? '#EEF5FC' : 'transparent',
                        color:       theme===t.v ? '#2E6DA4' : isDark?'#94A3B8':'#6B7280',
                      }}>
                        {t.icon}{t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height:1, background: isDark?'#334155':'#F3F4F6' }}/>

                {/* Cerrar sesión */}
                <button onClick={handleLogout} style={{
                  width:'100%', display:'flex', alignItems:'center', gap:'.75rem',
                  padding:'.85rem 1rem', background:'none', border:'none',
                  cursor:'pointer', fontSize:'.9rem', textAlign:'left',
                  color:'#DC2626',
                }}>
                  <LogOut size={17} color="#DC2626"/>
                  <span style={{ fontWeight:600 }}>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ flex:1, padding:'1rem', paddingBottom:'calc(5rem + env(safe-area-inset-bottom))', maxWidth:600, margin:'0 auto', width:'100%' }}>
        <Outlet/>
      </main>

      <BottomNav/>
    </div>
  )
}
