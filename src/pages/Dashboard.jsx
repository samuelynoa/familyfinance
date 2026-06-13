import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCuentas, getGastos, getIngresos } from '../services/sheets'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingDown, TrendingUp, Wallet, Plus, ChevronRight } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'

const CATEG_ICONS = {
  'Supermercado': '🛒', 'Combustible': '⛽', 'Educación': '📚',
  'Salud': '🏥', 'Entretenimiento': '🎬', 'Servicios (agua/luz/internet)': '💡',
  'Comidas Fuera de Casa': '🍽️', 'Suscripciones': '📱', 'Mesada Familiar': '👨‍👩‍👧',
  'Préstamos': '🏦', 'Ahorros': '💰', 'Salidas': '🎉',
  'Ropa': '👗', 'Hogar': '🏠', 'Vacaciones': '✈️',
  'Mantenimiento Vehículo': '🚗', 'Deuda interna familiar': '🤝',
}

export default function Dashboard() {
  const { perfil, isAdmin } = useAuth()
  const { hideBalances } = usePrefs()
  const [cuentas,  setCuentas]  = useState([])
  const [gastos,   setGastos]   = useState([])
  const [ingresos, setIngresos] = useState([])
  const [loading,  setLoading]  = useState(true)

  const mes = format(new Date(), 'yyyy-MM')

  useEffect(() => {
    async function load() {
      try {
        const [c, g, i] = await Promise.all([
          getCuentas({ usuarioId: perfil?.id, isAdmin }),
          getGastos({ mes }),
          getIngresos({ mes }),
        ])
        setCuentas(c)
        setGastos(g)
        setIngresos(i)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [mes])

  const totalGastos   = gastos.reduce((s, g)  => s + (Number(g.monto_rdp)  || 0), 0)
  //const totalIngresos = ingresos.reduce((s, i) => s + (Number(i.monto_rdp) || 0), 0)
  const ingresosFamiliares = ingresos.filter(i => (i.visibilidad || 'privada') === 'familiar')
  const totalIngresos = ingresosFamiliares.reduce((s, i) => s + (Number(i.monto_rdp) || 0), 0)
  const ahorro        = totalIngresos - totalGastos

  const balanceRDP = cuentas
    .filter(c => c.solo_consulta !== 'true' && c.moneda === 'RD$')
    .reduce((s, c) => s + (Number(c.balance) || 0), 0)

  const balanceUSD = cuentas
    .filter(c => c.moneda === 'USD')
    .reduce((s, c) => s + (Number(c.balance) || 0), 0)

  const recentGastos = [...gastos]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5)

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  const nombreMes = format(new Date(), "MMMM yyyy", { locale: es })

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <p style={{ color: 'var(--color-text-muted,#9CA3AF)', fontSize: '.875rem' }}>
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <h2 style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-text,#1F2937)' }}>
          Hola, {perfil?.nombre?.split(' ')[0] || 'bienvenido'} 👋
        </h2>
      </div>

      <div style={styles.balanceCard}>
        <p style={{ color: 'rgba(255,255,255,.75)', fontSize: '.82rem', marginBottom: '.35rem' }}>
          Balance disponible RD$
        </p>
        <p style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.02em' }}>
          {hideBalances ? '••••••••' : fmt(balanceRDP)}
        </p>
        {balanceUSD > 0 && (
          <p style={{ color: 'rgba(255,255,255,.8)', fontSize: '.875rem', marginTop: '.25rem' }}>
            {hideBalances ? '+ $•••• USD' : '+ $' + fmtN(balanceUSD) + ' USD'}
          </p>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
        <StatCard icon={<TrendingDown size={18}/>} label={`Gastos ${nombreMes}`}   value={hideBalances ? 'RD$ ••••' : fmt(totalGastos)}   color="#DC2626" bg="#FEE2E2" />
        <StatCard icon={<TrendingUp   size={18}/>} label={`Ingresos ${nombreMes}`} value={hideBalances ? 'RD$ ••••' : fmt(totalIngresos)} color="#1B5E35" bg="#D4EDDA" />
      </div>

      {totalIngresos > 0 && (
        <div style={{
          ...styles.ahorroCard,
          background: ahorro >= 0 ? '#D4EDDA' : '#FEE2E2',
          color:      ahorro >= 0 ? '#1B5E35' : '#DC2626',
        }}>
          <span style={{ fontWeight: 700 }}>{ahorro >= 0 ? '💚 Ahorro del mes:' : '⚠️ Déficit del mes:'}</span>
          <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{fmt(Math.abs(ahorro))}</span>
        </div>
      )}

      <div style={styles.section}>
        <div className="flex justify-between items-center" style={{ marginBottom: '.75rem' }}>
          <h3 style={styles.sectionTitle}>Mis cuentas</h3>
          <Link to="/cuentas" style={styles.seeAll}>Ver todas <ChevronRight size={14}/></Link>
        </div>
        {cuentas.length === 0 ? (
          <div style={styles.empty}><Wallet size={28} color="#9CA3AF"/><p>Agrega cuentas desde Configuración</p></div>
        ) : (
          <div style={{ display: 'flex', gap: '.75rem', overflowX: 'auto', paddingBottom: '.25rem' }}>
            {cuentas.slice(0, 6).map(c => <CuentaChip key={c.id} cuenta={c} hideBalances={hideBalances}/>)}
          </div>
        )}
      </div>

      <div style={styles.section}>
        <div className="flex justify-between items-center" style={{ marginBottom: '.75rem' }}>
          <h3 style={styles.sectionTitle}>Últimos gastos</h3>
          <Link to="/gastos" style={styles.seeAll}>Ver todos <ChevronRight size={14}/></Link>
        </div>
        {recentGastos.length === 0 ? (
          <div style={styles.empty}><Wallet size={32} color="#9CA3AF"/><p>No hay gastos este mes</p></div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {recentGastos.map((g, i) => (
              <GastoRow key={g.id} gasto={g} last={i === recentGastos.length - 1}/>
            ))}
          </div>
        )}
      </div>

      <Link to="/gastos/nuevo" style={styles.fab} aria-label="Nuevo gasto">
        <Plus size={26} color="#fff"/>
      </Link>
    </div>
  )
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
        <div style={{ background: bg, color, borderRadius: 8, padding: '.3rem', display: 'flex' }}>{icon}</div>
        <span style={{ fontSize: '.75rem', color: 'var(--color-text-muted,#9CA3AF)', fontWeight: 600 }}>{label}</span>
      </div>
      <p style={{ fontWeight: 800, fontSize: '1.15rem', color }}>{value}</p>
    </div>
  )
}

function CuentaChip({ cuenta, hideBalances }) {
  return (
    <div style={{
      background: cuenta.color || '#2E6DA4', color: '#fff',
      borderRadius: 12, padding: '.7rem 1rem', minWidth: 140, flexShrink: 0,
    }}>
      <p style={{ fontSize: '.72rem', opacity: .8, marginBottom: '.2rem' }}>{cuenta.nombre}</p>
      <p style={{ fontWeight: 800, fontSize: '1rem' }}>
        {hideBalances ? '••••' : (cuenta.moneda === 'USD' ? '$' : 'RD$') + ' ' + fmtN(Number(cuenta.balance || 0))}
      </p>
      {cuenta.solo_consulta === 'true' && (
        <p style={{ fontSize: '.65rem', opacity: .7, marginTop: '.15rem' }}>Solo consulta</p>
      )}
    </div>
  )
}

function GastoRow({ gasto, last }) {
  const icon = CATEG_ICONS[gasto.categoria] || '💸'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '.85rem 1rem',
      borderBottom: last ? 'none' : '1px solid var(--color-border-secondary,#F3F4F6)', gap: '.85rem',
    }}>
      <div style={styles.gastoIcon}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--color-text,#1F2937)' }}>
          {gasto.comercio || gasto.descripcion || gasto.categoria}
        </p>
        <p style={{ fontSize: '.75rem', color: 'var(--color-text-muted,#9CA3AF)' }}>
          {gasto.categoria} · {gasto.tipo === 'personal' ? '👤 Personal' : '👨‍👩‍👧 Familiar'}
        </p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontWeight: 700, color: '#DC2626', fontSize: '.9rem' }}>
          -{gasto.monto_rdp ? `RD$${fmtN(Number(gasto.monto_rdp))}` : `$${gasto.monto_usd}`}
        </p>
        <p style={{ fontSize: '.72rem', color: 'var(--color-text-muted,#9CA3AF)' }}>{gasto.fecha}</p>
      </div>
    </div>
  )
}

const fmt  = n => `RD$ ${Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
const fmtN = n => Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })

const styles = {
  balanceCard: {
    background: 'linear-gradient(135deg, #1E3A5F 0%, #2E6DA4 100%)',
    color: '#fff', borderRadius: 20, padding: '1.5rem',
    marginBottom: '1.25rem', boxShadow: '0 8px 24px rgba(30,58,95,.35)',
  },
  section:      { marginBottom: '1.5rem' },
  sectionTitle: { fontWeight: 700, fontSize: '1rem', color: 'var(--color-text,#1F2937)' },
  seeAll: {
    display: 'flex', alignItems: 'center', gap: '.15rem',
    fontSize: '.8rem', color: '#2E6DA4', textDecoration: 'none', fontWeight: 600,
  },
  ahorroCard: {
    borderRadius: 12, padding: '.85rem 1rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '1.25rem',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '.5rem', padding: '2rem', color: 'var(--color-text-muted,#9CA3AF)', fontSize: '.9rem',
  },
  gastoIcon: {
    width: 40, height: 40, borderRadius: 12, background: 'var(--color-card-hover,#F3F4F6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.2rem', flexShrink: 0,
  },
  fab: {
    position: 'fixed',
    bottom: 'calc(4.5rem + env(safe-area-inset-bottom))',
    right: '1.25rem', width: 56, height: 56,
    background: 'linear-gradient(135deg, #1E3A5F, #2E6DA4)',
    borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', boxShadow: '0 6px 20px rgba(30,58,95,.45)',
    zIndex: 80, textDecoration: 'none',
  },
}
