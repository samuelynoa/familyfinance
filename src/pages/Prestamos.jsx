import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSheet, appendRow, updateRow } from '../services/sheets'
import { Plus, X, ChevronDown, ChevronUp, TrendingDown, Calendar, DollarSign } from 'lucide-react'

export default function Prestamos() {
  const { isAdmin, perfil } = useAuth()
  const [prestamos, setPrestamos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [expandId,  setExpandId]  = useState(null)
  const [form, setForm] = useState({
    nombre: '', capital_original: '', tasa_anual: '',
    cuota_mensual: '', fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '', cuenta_id: '', visibilidad: 'familiar',
  })

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await getSheet('prestamos')
      setPrestamos((data.rows || []).filter(r => {
      if (r.activo === 'false') return false
      if (r.visibilidad === 'privada') return isAdmin || r.owner_id === perfil?.id
      return true
    }))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleAdd(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const capital = Number(form.capital_original)
      await appendRow('prestamos', {
        id:               `pre_${Date.now()}`,
        nombre:           form.nombre,
        capital_original: capital.toFixed(2),
        capital_pendiente: capital.toFixed(2),
        tasa_anual:       form.tasa_anual,
        cuota_mensual:    form.cuota_mensual,
        fecha_inicio:     form.fecha_inicio,
        fecha_vencimiento: form.fecha_vencimiento,
        cuenta_id:        form.cuenta_id || '',
        activo:           'true',
        visibilidad:      form.visibilidad || 'familiar',
        owner_id:         perfil?.id || '',
      })
      await load()
      setShowForm(false)
      setForm({ nombre: '', capital_original: '', tasa_anual: '', cuota_mensual: '', fecha_inicio: new Date().toISOString().split('T')[0], fecha_vencimiento: '', cuenta_id: '' })
    } catch { setError('Error al guardar. Intenta de nuevo.') }
    finally { setSaving(false) }
  }

  // Calcular tabla de amortización simplificada
  function calcularAmortizacion(prestamo) {
    const capital  = Number(prestamo.capital_pendiente || 0)
    const tasaMens = Number(prestamo.tasa_anual || 0) / 100 / 12
    const cuota    = Number(prestamo.cuota_mensual || 0)
    if (!cuota || !capital) return []

    const filas = []
    let saldo = capital
    for (let i = 1; i <= Math.min(12, 360) && saldo > 0; i++) {
      const interes    = saldo * tasaMens
      const capitalPag = Math.min(cuota - interes, saldo)
      saldo -= capitalPag
      filas.push({
        mes:       i,
        cuota:     cuota.toFixed(2),
        interes:   interes.toFixed(2),
        capital:   capitalPag.toFixed(2),
        saldo:     Math.max(saldo, 0).toFixed(2),
      })
    }
    return filas
  }

  const totalPendiente = prestamos.reduce((s, p) => s + Number(p.capital_pendiente || 0), 0)

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700 }}>Préstamos</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            <Plus size={16} /> Nuevo
          </button>
        )}
      </div>

      {/* Resumen */}
      {prestamos.length > 0 && (
        <div style={S.summaryCard}>
          <TrendingDown size={22} color="#fff" style={{ opacity: .8 }} />
          <div>
            <p style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.75)' }}>Total deuda pendiente</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>RD$ {fmtN(totalPendiente)}</p>
          </div>
        </div>
      )}

      {/* Formulario */}
      {showForm && isAdmin && (
        <form className="card" style={{ marginBottom: '1rem' }} onSubmit={handleAdd}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 600 }}>Nuevo préstamo</h3>
            <button type="button" onClick={() => setShowForm(false)} style={S.closeBtn}><X size={18} /></button>
          </div>
          <div className="field">
            <label className="label">Nombre del préstamo</label>
            <input className="input" placeholder="Ej: Hipoteca BHD, Préstamo Personal"
              value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="label">Capital original (RD$)</label>
              <input className="input" type="number" placeholder="500000" step="0.01"
                value={form.capital_original} onChange={e => setForm(f => ({ ...f, capital_original: e.target.value }))} required />
            </div>
            <div className="field">
              <label className="label">Tasa anual (%)</label>
              <input className="input" type="number" placeholder="14.5" step="0.01"
                value={form.tasa_anual} onChange={e => setForm(f => ({ ...f, tasa_anual: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="label">Cuota mensual (RD$)</label>
              <input className="input" type="number" placeholder="15000" step="0.01"
                value={form.cuota_mensual} onChange={e => setForm(f => ({ ...f, cuota_mensual: e.target.value }))} required />
            </div>
            <div className="field">
              <label className="label">Fecha de inicio</label>
              <input className="input" type="date"
                value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label className="label">Fecha de vencimiento</label>
            <input className="input" type="date"
              value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label">Visibilidad</label>
            <div style={{ display:'flex', gap:'.75rem' }}>
              {[{v:'familiar',l:'👨‍👩‍👧 Familiar'},{v:'privada',l:'🔒 Privada'}].map(({v,l}) => (
                <button key={v} type="button" onClick={() => setForm(f=>({...f, visibilidad:v}))}
                  style={{ flex:1, padding:'.6rem', borderRadius:10, border:'1.5px solid', cursor:'pointer', fontWeight:600, fontSize:'.85rem',
                    borderColor: form.visibilidad===v?'#2E6DA4':'#E5E7EB', background: form.visibilidad===v?'#EEF5FC':'#fff',
                    color: form.visibilidad===v?'#2E6DA4':'#4B5563' }}>
                  {l}
                </button>
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

      {/* Lista */}
      {prestamos.length === 0 && !showForm ? (
        <div style={S.empty}>
          <DollarSign size={40} color="#9CA3AF" />
          <p style={{ fontWeight: 600 }}>No hay préstamos registrados</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {prestamos.map(p => {
            const pct = Number(p.capital_original) > 0
              ? ((Number(p.capital_original) - Number(p.capital_pendiente)) / Number(p.capital_original)) * 100
              : 0
            const amort = expandId === p.id ? calcularAmortizacion(p) : []
            return (
              <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => setExpandId(expandId === p.id ? null : p.id)}>
                  <div className="flex justify-between items-center" style={{ marginBottom: '.75rem' }}>
                    <div>
                      <p style={{ fontWeight: 700 }}>{p.nombre}</p>
                      <p style={{ fontSize: '.78rem', color: '#9CA3AF' }}>
                        Tasa: {p.tasa_anual}% anual · Cuota: RD$ {fmtN(Number(p.cuota_mensual))}
                      </p>
                    </div>
                    {expandId === p.id ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
                  </div>

                  {/* Barra de progreso */}
                  <div style={{ marginBottom: '.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.3rem' }}>
                      <span style={{ fontSize: '.78rem', color: '#9CA3AF' }}>
                        Pagado: RD$ {fmtN(Number(p.capital_original) - Number(p.capital_pendiente))}
                      </span>
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#2E6DA4' }}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#F3F4F6', borderRadius: 99 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#2E6DA4', borderRadius: 99, transition: 'width .4s' }} />
                    </div>
                  </div>

                  <div className="grid-2">
                    <div style={S.statBox}>
                      <p style={{ fontSize: '.72rem', color: '#9CA3AF' }}>Capital pendiente</p>
                      <p style={{ fontWeight: 700, color: '#DC2626' }}>RD$ {fmtN(Number(p.capital_pendiente))}</p>
                    </div>
                    <div style={S.statBox}>
                      <p style={{ fontSize: '.72rem', color: '#9CA3AF' }}>Vence</p>
                      <p style={{ fontWeight: 700 }}>{p.fecha_vencimiento || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Tabla amortización */}
                {expandId === p.id && (
                  <div style={{ borderTop: '1px solid #F3F4F6' }}>
                    <p style={{ fontSize: '.72rem', fontWeight: 700, color: '#9CA3AF', padding: '.6rem 1rem .3rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Próximas 12 cuotas
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                        <thead>
                          <tr style={{ background: '#F9FAFB' }}>
                            {['Mes','Cuota','Interés','Capital','Saldo'].map(h => (
                              <th key={h} style={{ padding: '.5rem .75rem', textAlign: 'right', color: '#6B7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {amort.map((f, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                              <td style={{ padding: '.5rem .75rem', textAlign: 'right', color: '#6B7280' }}>{f.mes}</td>
                              <td style={{ padding: '.5rem .75rem', textAlign: 'right', fontWeight: 600 }}>{fmtN(Number(f.cuota))}</td>
                              <td style={{ padding: '.5rem .75rem', textAlign: 'right', color: '#DC2626' }}>{fmtN(Number(f.interes))}</td>
                              <td style={{ padding: '.5rem .75rem', textAlign: 'right', color: '#1B5E35' }}>{fmtN(Number(f.capital))}</td>
                              <td style={{ padding: '.5rem .75rem', textAlign: 'right', fontWeight: 600 }}>{fmtN(Number(f.saldo))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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
    background: 'linear-gradient(135deg, #B91C1C, #DC2626)', color: '#fff',
    borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '1.25rem',
    display: 'flex', alignItems: 'center', gap: '1rem',
    boxShadow: '0 6px 20px rgba(185,28,28,.3)',
  },
  statBox: { background: '#F9FAFB', borderRadius: 10, padding: '.6rem .75rem' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' },
  errorBox: { background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '.65rem .9rem', fontSize: '.875rem', marginBottom: '.75rem' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.75rem', padding: '3rem 1rem', textAlign: 'center' },
}
