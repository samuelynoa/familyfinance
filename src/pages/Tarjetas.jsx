import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSheet, appendRow } from '../services/sheets'
import { CreditCard, Plus, X, AlertCircle } from 'lucide-react'

const COLORES = ['#1E3A5F','#B91C1C','#1B5E35','#5B21B6','#7A4800','#0E7490']

export default function Tarjetas() {
  const { isAdmin } = useAuth()
  const [tarjetas, setTarjetas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [form, setForm] = useState({
    nombre: '', banco: '', limite: '', moneda: 'RD$',
    fecha_corte: '25', color: COLORES[0],
  })

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await getSheet('tarjetas_credito')
      setTarjetas((data.rows || []).filter(r => r.activa === 'true'))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleAdd(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      await appendRow('tarjetas_credito', {
        id: `tc_${Date.now()}`,
        nombre:      form.nombre,
        banco:       form.banco,
        limite:      form.limite,
        saldo_usado: '0',
        fecha_corte: form.fecha_corte,
        moneda:      form.moneda,
        activa:      'true',
        color:       form.color,
      })
      await load()
      setShowForm(false)
      setForm({ nombre: '', banco: '', limite: '', moneda: 'RD$', fecha_corte: '25', color: COLORES[0] })
    } catch { setError('Error al guardar. Intenta de nuevo.') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700 }}>Tarjetas de crédito</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            <Plus size={16} /> Nueva
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form className="card" style={{ marginBottom: '1rem' }} onSubmit={handleAdd}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 600 }}>Nueva tarjeta</h3>
            <button type="button" onClick={() => setShowForm(false)} style={S.closeBtn}><X size={18} /></button>
          </div>
          <div className="field">
            <label className="label">Nombre de la tarjeta</label>
            <input className="input" placeholder="Ej: Visa BanReservas"
              value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="label">Banco</label>
              <input className="input" placeholder="BanReservas"
                value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Moneda</label>
              <select className="input" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                <option value="RD$">RD$</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="label">Límite de crédito</label>
              <input className="input" type="number" placeholder="150000" step="0.01"
                value={form.limite} onChange={e => setForm(f => ({ ...f, limite: e.target.value }))} required />
            </div>
            <div className="field">
              <label className="label">Día de corte</label>
              <input className="input" type="number" min="1" max="31" placeholder="25"
                value={form.fecha_corte} onChange={e => setForm(f => ({ ...f, fecha_corte: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label className="label">Color</label>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              {COLORES.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: form.color === c ? '3px solid #1F2937' : '2px solid #E5E7EB' }} />
              ))}
            </div>
          </div>
          {error && <div style={S.errorBox}>{error}</div>}
          <div style={{ display: 'flex', gap: '.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {tarjetas.length === 0 && !showForm ? (
        <div style={S.empty}>
          <CreditCard size={40} color="#9CA3AF" />
          <p style={{ fontWeight: 600 }}>No hay tarjetas registradas</p>
          {isAdmin && <p style={{ fontSize: '.875rem', color: '#9CA3AF' }}>Agrega tu primera tarjeta de crédito</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tarjetas.map(t => <TarjetaCard key={t.id} tarjeta={t} />)}
        </div>
      )}
    </div>
  )
}

function TarjetaCard({ tarjeta }) {
  const limite = Number(tarjeta.limite || 0)
  const usado  = Number(tarjeta.saldo_usado || 0)
  const disponible = limite - usado
  const pct = limite > 0 ? Math.min((usado / limite) * 100, 100) : 0
  const color = pct > 80 ? '#DC2626' : pct > 60 ? '#7A4800' : '#1B5E35'

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
      {/* Tarjeta visual */}
      <div style={{
        background: `linear-gradient(135deg, ${tarjeta.color || '#1E3A5F'}, ${tarjeta.color || '#2E6DA4'}cc)`,
        padding: '1.25rem', color: '#fff',
      }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
          <div>
            <p style={{ fontSize: '.75rem', opacity: .8 }}>{tarjeta.banco}</p>
            <p style={{ fontWeight: 700, fontSize: '1.05rem' }}>{tarjeta.nombre}</p>
          </div>
          <CreditCard size={28} style={{ opacity: .8 }} />
        </div>
        <div className="flex justify-between items-center">
          <div>
            <p style={{ fontSize: '.72rem', opacity: .75 }}>Saldo usado</p>
            <p style={{ fontWeight: 800, fontSize: '1.2rem' }}>
              {tarjeta.moneda === 'USD' ? '$' : 'RD$'} {fmtN(usado)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '.72rem', opacity: .75 }}>Disponible</p>
            <p style={{ fontWeight: 700, fontSize: '1rem' }}>
              {tarjeta.moneda === 'USD' ? '$' : 'RD$'} {fmtN(disponible)}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de uso */}
      <div style={{ background: '#fff', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.4rem' }}>
          <span style={{ fontSize: '.78rem', color: '#9CA3AF' }}>
            Límite: {tarjeta.moneda === 'USD' ? '$' : 'RD$'} {fmtN(limite)}
          </span>
          <span style={{ fontSize: '.78rem', fontWeight: 700, color }}>
            {pct.toFixed(0)}% usado
          </span>
        </div>
        <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width .4s' }} />
        </div>
        {pct > 80 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', marginTop: '.5rem', color: '#DC2626', fontSize: '.78rem' }}>
            <AlertCircle size={14} /> Cerca del límite
          </div>
        )}
        <p style={{ fontSize: '.75rem', color: '#9CA3AF', marginTop: '.4rem' }}>
          Corte día {tarjeta.fecha_corte} · {tarjeta.moneda}
        </p>
      </div>
    </div>
  )
}

const fmtN = n => Math.abs(Number(n)).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const S = {
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: '.25rem' },
  errorBox: { background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '.65rem .9rem', fontSize: '.875rem', marginBottom: '.75rem' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.75rem', padding: '3rem 1rem', textAlign: 'center' },
}
