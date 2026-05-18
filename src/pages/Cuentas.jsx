import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getCuentas, addCuenta, getSheet } from '../services/sheets'
import { Plus, Eye, EyeOff, Wallet, Lock, ChevronDown, ChevronUp, X } from 'lucide-react'

const TIPOS = [
  { value: 'corriente',      label: 'Corriente / Ahorro banco', icon: '🏦' },
  { value: 'dolares',        label: 'Cuenta USD',               icon: '💵' },
  { value: 'efectivo',       label: 'Efectivo / Billetera',     icon: '💵' },
  { value: 'ahorro',         label: 'Cuenta de ahorros',        icon: '🐷' },
  { value: 'cooperativa',    label: 'Cooperativa',              icon: '🤝' },
  { value: 'certificado',    label: 'Certificado financiero',   icon: '📜' },
  { value: 'fondo',          label: 'Fondo de inversión',       icon: '📈' },
  { value: 'tarjeta_debito', label: 'Tarjeta débito',           icon: '💳' },
]
const COLORES = ['#2E6DA4','#1B5E35','#7A4800','#5B21B6','#BE185D','#0E7490','#1E3A5F','#B91C1C']
const TIPO_MAP = Object.fromEntries(TIPOS.map(t => [t.value, t]))

export default function Cuentas() {
  const { isAdmin } = useAuth()
  const [cuentas,      setCuentas]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [hideBalances, setHideBalances] = useState(false)
  const [expandId,     setExpandId]     = useState(null)
  const [movimientos,  setMovimientos]  = useState([])
  const [form, setForm] = useState({
    nombre: '', tipo: 'corriente', moneda: 'RD$',
    balance: '', solo_consulta: false, color: COLORES[0],
  })

  useEffect(() => { load() }, [])

  async function load() {
    try { setCuentas(await getCuentas()) }
    catch (e) { console.error(e) }
    finally   { setLoading(false) }
  }

  async function handleAdd(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const soloConsulta = form.solo_consulta || form.tipo === 'cooperativa'
      await addCuenta({ ...form, solo_consulta: soloConsulta })
      await load()
      setShowForm(false)
      setForm({ nombre: '', tipo: 'corriente', moneda: 'RD$', balance: '', solo_consulta: false, color: COLORES[0] })
    } catch { setError('Error al guardar. Intenta de nuevo.') }
    finally { setSaving(false) }
  }

  async function toggleExpand(cuentaId) {
    if (expandId === cuentaId) { setExpandId(null); return }
    setExpandId(cuentaId)
    try {
      const [gd, td] = await Promise.all([getSheet('gastos'), getSheet('transferencias')])
      const gastos = (gd.rows || [])
        .filter(r => r.cuenta_id === cuentaId || r.cuenta_destino_id === cuentaId)
        .map(r => ({
          fecha: r.fecha,
          desc:  r.comercio || r.descripcion || r.categoria,
          monto: r.cuenta_id === cuentaId
            ? -Math.abs(Number(r.monto_rdp || r.monto_usd || 0))
            :  Math.abs(Number(r.monto_rdp || r.monto_usd || 0)),
        }))
      const trans = (td.rows || [])
        .filter(r => r.cuenta_origen_id === cuentaId || r.cuenta_destino_id === cuentaId)
        .map(r => ({
          fecha: r.fecha,
          desc:  r.descripcion || 'Transferencia',
          monto: r.cuenta_origen_id === cuentaId
            ? -Math.abs(Number(r.monto || 0))
            :  Math.abs(Number(r.monto || 0)),
        }))
      setMovimientos([...gastos, ...trans].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10))
    } catch { setMovimientos([]) }
  }

  const totalRDP = cuentas.filter(c => c.moneda === 'RD$' && c.solo_consulta !== 'true').reduce((s, c) => s + (Number(c.balance) || 0), 0)
  const totalUSD = cuentas.filter(c => c.moneda === 'USD').reduce((s, c) => s + (Number(c.balance) || 0), 0)
  const operativas = cuentas.filter(c => c.solo_consulta !== 'true')
  const consulta   = cuentas.filter(c => c.solo_consulta === 'true')

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700 }}>Mis cuentas</h2>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="btn btn-secondary" style={{ padding: '.5rem .7rem' }} onClick={() => setHideBalances(v => !v)}>
            {hideBalances ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
              <Plus size={16} /> Nueva
            </button>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div style={S.summaryCard}>
        <div>
          <p style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.75)', marginBottom: '.2rem' }}>Disponible RD$</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            {hideBalances ? '•••••••' : `RD$ ${fmtN(totalRDP)}`}
          </p>
        </div>
        {totalUSD > 0 && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.75)', marginBottom: '.2rem' }}>USD</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {hideBalances ? '••••' : `$${fmtN(totalUSD)}`}
            </p>
          </div>
        )}
      </div>

      {/* Formulario */}
      {showForm && isAdmin && (
        <form className="card" style={{ marginBottom: '1rem' }} onSubmit={handleAdd}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 600 }}>Nueva cuenta</h3>
            <button type="button" onClick={() => setShowForm(false)} style={S.closeBtn}><X size={18} /></button>
          </div>
          <div className="field">
            <label className="label">Nombre</label>
            <input className="input" placeholder="Ej: BanReservas Corriente"
              value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="label">Tipo</label>
              <select className="input" value={form.tipo} onChange={e => {
                const tipo = e.target.value
                setForm(f => ({
                  ...f, tipo,
                  moneda: (tipo === 'dolares' || tipo === 'fondo') ? 'USD' : 'RD$',
                  solo_consulta: tipo === 'cooperativa',
                }))
              }}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Moneda</label>
              <select className="input" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                <option value="RD$">RD$ Pesos</option>
                <option value="USD">USD Dólares</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label">Balance inicial</label>
            <input className="input" type="number" placeholder="0.00" step="0.01"
              value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label">Color</label>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {COLORES.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: form.color === c ? '3px solid #1F2937' : '2px solid #E5E7EB' }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}>
            <input type="checkbox" id="sc" checked={form.solo_consulta}
              onChange={e => setForm(f => ({ ...f, solo_consulta: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: 'pointer' }} />
            <label htmlFor="sc" style={{ fontSize: '.9rem', cursor: 'pointer' }}>
              Solo consulta (no se descuenta al registrar gastos)
            </label>
          </div>
          {error && <div style={S.errorBox}>{error}</div>}
          <div style={{ display: 'flex', gap: '.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Lista operativas */}
      {operativas.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={S.secLabel}><Wallet size={13} /> Cuentas operativas</p>
          {operativas.map(c => (
            <CuentaCard key={c.id} cuenta={c} hide={hideBalances}
              expanded={expandId === c.id} movs={expandId === c.id ? movimientos : []}
              onToggle={() => toggleExpand(c.id)} />
          ))}
        </div>
      )}

      {/* Lista solo consulta */}
      {consulta.length > 0 && (
        <div>
          <p style={S.secLabel}><Lock size={13} /> Solo consulta</p>
          {consulta.map(c => (
            <CuentaCard key={c.id} cuenta={c} hide={hideBalances}
              expanded={expandId === c.id} movs={expandId === c.id ? movimientos : []}
              onToggle={() => toggleExpand(c.id)} />
          ))}
        </div>
      )}

      {cuentas.length === 0 && !showForm && (
        <div style={S.empty}>
          <Wallet size={40} color="#9CA3AF" />
          <p style={{ fontWeight: 600 }}>No hay cuentas aún</p>
          <p style={{ fontSize: '.875rem', color: '#9CA3AF' }}>
            {isAdmin ? 'Crea tu primera cuenta con el botón "Nueva"' : 'El admin debe crear las cuentas primero'}
          </p>
        </div>
      )}
    </div>
  )
}

function CuentaCard({ cuenta, hide, expanded, movs, onToggle }) {
  const tipo    = TIPO_MAP[cuenta.tipo] || { label: cuenta.tipo, icon: '💳' }
  const balance = Number(cuenta.balance || 0)
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', gap: '1rem', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: cuenta.color || '#2E6DA4',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
          {tipo.icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: '.95rem' }}>{cuenta.nombre}</p>
          <p style={{ fontSize: '.78rem', color: '#9CA3AF' }}>{tipo.label}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 800, fontSize: '1rem', color: balance < 0 ? '#DC2626' : '#1F2937' }}>
            {hide ? '••••' : `${cuenta.moneda === 'USD' ? '$' : 'RD$'} ${fmtN(balance)}`}
          </p>
          {cuenta.solo_consulta === 'true' && (
            <span style={{ fontSize: '.68rem', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '.2rem', justifyContent: 'flex-end' }}>
              <Lock size={10} /> Solo consulta
            </span>
          )}
        </div>
        <div style={{ color: '#9CA3AF' }}>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #F3F4F6' }}>
          <p style={{ fontSize: '.72rem', fontWeight: 700, color: '#9CA3AF', padding: '.5rem 1rem .25rem', textTransform: 'uppercase' }}>
            Últimos movimientos
          </p>
          {movs.length === 0
            ? <p style={{ padding: '1rem', color: '#9CA3AF', fontSize: '.875rem', textAlign: 'center' }}>Sin movimientos</p>
            : movs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '.6rem 1rem', borderBottom: i < movs.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                <div>
                  <p style={{ fontSize: '.85rem', fontWeight: 500 }}>{m.desc}</p>
                  <p style={{ fontSize: '.72rem', color: '#9CA3AF' }}>{m.fecha}</p>
                </div>
                <p style={{ fontWeight: 700, fontSize: '.85rem', color: m.monto >= 0 ? '#1B5E35' : '#DC2626' }}>
                  {m.monto >= 0 ? '+' : '-'}RD${fmtN(Math.abs(m.monto))}
                </p>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

const fmtN = n => Math.abs(Number(n)).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const S = {
  summaryCard: {
    background: 'linear-gradient(135deg, #1E3A5F 0%, #2E6DA4 100%)', color: '#fff',
    borderRadius: 20, padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 8px 24px rgba(30,58,95,.3)',
  },
  secLabel: { fontSize: '.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: '.06em', marginBottom: '.5rem', display: 'flex', alignItems: 'center', gap: '.35rem' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: '.25rem' },
  errorBox: { background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '.65rem .9rem', fontSize: '.875rem', marginBottom: '.75rem' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.75rem', padding: '3rem 1rem', textAlign: 'center' },
}
