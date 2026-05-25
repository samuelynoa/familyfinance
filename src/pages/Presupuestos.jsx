import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSheet, appendRow, updateRow, getGastos } from '../services/sheets'
import { Plus, X, Bell, BellOff, AlertCircle, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'

const CATEGORIAS = [
  'Supermercado','Combustible','Educación','Salud','Entretenimiento',
  'Servicios (agua/luz/internet)','Comidas Fuera de Casa','Suscripciones',
  'Mesada Familiar','Préstamos','Ahorros','Salidas','Ropa','Hogar',
  'Vacaciones','Mantenimiento Vehículo',
]

const CATEG_ICONS = {
  'Supermercado':'🛒','Combustible':'⛽','Educación':'📚','Salud':'🏥',
  'Entretenimiento':'🎬','Servicios (agua/luz/internet)':'💡','Comidas Fuera de Casa':'🍽️',
  'Suscripciones':'📱','Mesada Familiar':'👨‍👩‍👧','Préstamos':'🏦','Ahorros':'💰',
  'Salidas':'🎉','Ropa':'👗','Hogar':'🏠','Vacaciones':'✈️','Mantenimiento Vehículo':'🚗',
}

export default function Presupuestos() {
  const { isAdmin } = useAuth()
  const [presupuestos, setPresupuestos] = useState([])
  const [gastosDelMes, setGastosDelMes] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [form, setForm] = useState({
    categoria: '', monto_mensual_rdp: '', alerta_80: 'true', alerta_100: 'true',
  })

  const mes = format(new Date(), 'yyyy-MM')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [presData, gastosData] = await Promise.all([
        getSheet('presupuestos'),
        getGastos({ mes }),
      ])
      setPresupuestos((presData.rows || []).filter(r => r.activo !== 'false'))
      setGastosDelMes(gastosData)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleAdd(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      // Verificar si ya existe presupuesto para esa categoría
      const existe = presupuestos.find(p => p.categoria === form.categoria)
      if (existe) {
        // Actualizar existente
        const data = await getSheet('presupuestos')
        const idx  = (data.rows || []).findIndex(r => r.categoria === form.categoria)
        if (idx !== -1) {
          await updateRow('presupuestos', idx + 2, {
            ...existe,
            monto_mensual_rdp: form.monto_mensual_rdp,
            alerta_80:  form.alerta_80,
            alerta_100: form.alerta_100,
            activo: 'true',
          })
        }
      } else {
        await appendRow('presupuestos', {
          id:               `pre_${Date.now()}`,
          categoria:        form.categoria,
          monto_mensual_rdp: form.monto_mensual_rdp,
          alerta_80:        form.alerta_80,
          alerta_100:       form.alerta_100,
          activo:           'true',
        })
      }
      await load()
      setShowForm(false)
      setForm({ categoria: '', monto_mensual_rdp: '', alerta_80: 'true', alerta_100: 'true' })
    } catch { setError('Error al guardar. Intenta de nuevo.') }
    finally { setSaving(false) }
  }

  // Calcular gasto actual por categoría
  function gastoCategoria(categoria) {
    return gastosDelMes
      .filter(g => g.categoria === categoria)
      .reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)
  }

  const mesLabel = format(new Date(), 'MMMM yyyy')

  // Ordenar: alertas primero, luego por % de uso
  const presupuestosOrdenados = [...presupuestos].map(p => ({
    ...p,
    gastado: gastoCategoria(p.categoria),
    pct: Number(p.monto_mensual_rdp) > 0
      ? (gastoCategoria(p.categoria) / Number(p.monto_mensual_rdp)) * 100
      : 0,
  })).sort((a, b) => b.pct - a.pct)

  const totalPresupuestado = presupuestos.reduce((s, p) => s + Number(p.monto_mensual_rdp || 0), 0)
  const totalGastado = presupuestosOrdenados.reduce((s, p) => s + p.gastado, 0)
  const pctTotal = totalPresupuestado > 0 ? (totalGastado / totalPresupuestado) * 100 : 0

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700 }}>Presupuestos</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            <Plus size={16} /> Nuevo
          </button>
        )}
      </div>

      {/* Resumen del mes */}
      {presupuestos.length > 0 && (
        <div style={S.summaryCard}>
          <div style={{ marginBottom: '.75rem' }}>
            <p style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.75)', marginBottom: '.2rem' }}>
              Resumen {mesLabel}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <p style={{ fontSize: '1.6rem', fontWeight: 800 }}>RD$ {fmtN(totalGastado)}</p>
              <p style={{ fontSize: '.9rem', opacity: .8 }}>de RD$ {fmtN(totalPresupuestado)}</p>
            </div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,.25)', borderRadius: 99 }}>
            <div style={{
              height: '100%', borderRadius: 99, transition: 'width .4s',
              width: `${Math.min(pctTotal, 100)}%`,
              background: pctTotal > 100 ? '#FCA5A5' : pctTotal > 80 ? '#FDE68A' : '#BBF7D0',
            }} />
          </div>
          <p style={{ fontSize: '.78rem', opacity: .8, marginTop: '.4rem', textAlign: 'right' }}>
            {pctTotal.toFixed(0)}% del presupuesto total usado
          </p>
        </div>
      )}

      {/* Formulario */}
      {showForm && isAdmin && (
        <form className="card" style={{ marginBottom: '1rem' }} onSubmit={handleAdd}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 600 }}>Nuevo presupuesto</h3>
            <button type="button" onClick={() => setShowForm(false)} style={S.closeBtn}><X size={18} /></button>
          </div>
          <div className="field">
            <label className="label">Categoría</label>
            <select className="input" value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} required>
              <option value="">Seleccionar categoría</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{CATEG_ICONS[c]} {c}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Presupuesto mensual (RD$)</label>
            <input className="input" type="number" placeholder="15000" step="0.01"
              value={form.monto_mensual_rdp}
              onChange={e => setForm(f => ({ ...f, monto_mensual_rdp: e.target.value }))} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1rem' }}>
            <label className="label">Alertas por email</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              <input type="checkbox" id="a80" checked={form.alerta_80 === 'true'}
                onChange={e => setForm(f => ({ ...f, alerta_80: e.target.checked ? 'true' : 'false' }))}
                style={{ width: 18, height: 18 }} />
              <label htmlFor="a80" style={{ fontSize: '.9rem', cursor: 'pointer' }}>
                Alertar al 80% del presupuesto
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              <input type="checkbox" id="a100" checked={form.alerta_100 === 'true'}
                onChange={e => setForm(f => ({ ...f, alerta_100: e.target.checked ? 'true' : 'false' }))}
                style={{ width: 18, height: 18 }} />
              <label htmlFor="a100" style={{ fontSize: '.9rem', cursor: 'pointer' }}>
                Alertar al 100% (presupuesto agotado)
              </label>
            </div>
          </div>
          {error && <div style={S.errorBox}>{error}</div>}
          <div style={{ display: 'flex', gap: '.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Lista presupuestos */}
      {presupuestosOrdenados.length === 0 && !showForm ? (
        <div style={S.empty}>
          <Bell size={40} color="#9CA3AF" />
          <p style={{ fontWeight: 600 }}>No hay presupuestos configurados</p>
          <p style={{ fontSize: '.875rem', color: '#9CA3AF' }}>
            {isAdmin ? 'Define límites de gasto por categoría' : 'El admin debe configurar los presupuestos'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {presupuestosOrdenados.map(p => {
            const pct   = p.pct
            const color = pct >= 100 ? '#DC2626' : pct >= 80 ? '#D97706' : '#1B5E35'
            const bgBar = pct >= 100 ? '#DC2626' : pct >= 80 ? '#F59E0B' : '#2E6DA4'
            return (
              <div key={p.id} className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.75rem' }}>
                  <div style={{ fontSize: '1.5rem', width: 40, textAlign: 'center', flexShrink: 0 }}>
                    {CATEG_ICONS[p.categoria] || '💸'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontWeight: 600, fontSize: '.95rem' }}>{p.categoria}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                        {pct >= 100 && <AlertCircle size={16} color="#DC2626" />}
                        {pct < 80  && <CheckCircle  size={16} color="#1B5E35" />}
                        {p.alerta_80 === 'true'
                          ? <Bell size={14} color="#9CA3AF" />
                          : <BellOff size={14} color="#D1D5DB" />
                        }
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: '#9CA3AF', marginTop: '.1rem' }}>
                      <span>RD$ {fmtN(p.gastado)} gastado</span>
                      <span style={{ fontWeight: 700, color }}>
                        {pct.toFixed(0)}% de RD$ {fmtN(Number(p.monto_mensual_rdp))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barra */}
                <div style={{ height: 8, background: '#F3F4F6', borderRadius: 99 }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${Math.min(pct, 100)}%`,
                    background: bgBar,
                    transition: 'width .4s',
                  }} />
                </div>

                {/* Restante */}
                <p style={{ fontSize: '.75rem', marginTop: '.4rem', color: pct >= 100 ? '#DC2626' : '#6B7280' }}>
                  {pct >= 100
                    ? `⚠️ Excedido en RD$ ${fmtN(p.gastado - Number(p.monto_mensual_rdp))}`
                    : `Disponible: RD$ ${fmtN(Number(p.monto_mensual_rdp) - p.gastado)}`
                  }
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const fmtN = n => Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const S = {
  summaryCard: {
    background: 'linear-gradient(135deg, #1E3A5F, #2E6DA4)', color: '#fff',
    borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '1.25rem',
    boxShadow: '0 6px 20px rgba(30,58,95,.3)',
  },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' },
  errorBox: { background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '.65rem .9rem', fontSize: '.875rem', marginBottom: '.75rem' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.75rem', padding: '3rem 1rem', textAlign: 'center', color: '#1F2937' },
}
