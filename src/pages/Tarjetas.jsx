import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { getSheet, appendRow } from '../services/sheets'
import { CreditCard, Plus, X, AlertCircle } from 'lucide-react'

const COLORES = ['#1E3A5F','#B91C1C','#1B5E35','#5B21B6','#7A4800','#0E7490']
const FORM0   = { nombre:'', banco:'', moneda_rdp:true, moneda_usd:false, limite_rdp:'', limite_usd:'', fecha_corte:'25', color:COLORES[0], visibilidad:'familiar' }

export default function Tarjetas() {
  const { perfil }          = useAuth()   // cualquier usuario puede agregar tarjetas
  const { hideBalances }    = usePrefs()
  const [tarjetas, setTarjetas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [form, setForm]         = useState(FORM0)

  useEffect(() => { load() }, [perfil])

  async function load() {
    try {
      const data = await getSheet('tarjetas_credito')
      // Cada usuario ve las familiares + sus privadas
      setTarjetas((data.rows||[]).filter(r => {
        if (r.activa !== 'true') return false
        if (r.visibilidad === 'privada') return r.owner_id === perfil?.id
        return true
      }))
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleAdd(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      if (!form.moneda_rdp && !form.moneda_usd) throw new Error('Selecciona al menos una moneda')
      await appendRow('tarjetas_credito', {
        id:              `tc_${Date.now()}`,
        nombre:          form.nombre,
        banco:           form.banco,
        limite:          form.moneda_rdp ? form.limite_rdp : '0',
        saldo_usado:     '0',
        limite_usd:      form.moneda_usd ? form.limite_usd : '0',
        saldo_usado_usd: '0',
        fecha_corte:     form.fecha_corte,
        moneda:          form.moneda_rdp ? 'RD$' : 'USD',
        activa:          'true',
        color:           form.color,
        visibilidad:     form.visibilidad,
        owner_id:        perfil?.id || '',
      })
      await load()
      setShowForm(false)
      setForm(FORM0)
    } catch(e) { setError(e.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="spinner-center"><div className="spinner"/></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
        <h2 style={{ fontWeight:700 }}>Tarjetas de crédito</h2>
        {/* Cualquier usuario puede agregar sus tarjetas */}
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          <Plus size={16}/> Nueva
        </button>
      </div>

      {showForm && (
        <form className="card" style={{ marginBottom:'1rem' }} onSubmit={handleAdd}>
          <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
            <h3 style={{ fontWeight:600 }}>Nueva tarjeta</h3>
            <button type="button" onClick={() => setShowForm(false)} style={S.close}><X size={18}/></button>
          </div>

          <div className="field">
            <label className="label">Nombre de la tarjeta</label>
            <input className="input" placeholder="Ej: Visa BanReservas"
              value={form.nombre} onChange={e => setF('nombre', e.target.value)} required/>
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="label">Banco</label>
              <input className="input" placeholder="BanReservas"
                value={form.banco} onChange={e => setF('banco', e.target.value)}/>
            </div>
            <div className="field">
              <label className="label">Día de corte</label>
              <input className="input" type="number" min="1" max="31"
                value={form.fecha_corte} onChange={e => setF('fecha_corte', e.target.value)}/>
            </div>
          </div>

          {/* Doble saldo — límites separados */}
          <div className="field">
            <label className="label">Monedas (activa las que apliquen)</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
              {[
                { k:'moneda_rdp', lk:'limite_rdp', label:'RD$ Pesos dominicanos', ph:'150,000' },
                { k:'moneda_usd', lk:'limite_usd', label:'USD Dólares',           ph:'5,000'   },
              ].map(({ k, lk, label, ph }) => (
                <div key={k} style={{ border:`1.5px solid ${form[k]?'#2E6DA4':'#E5E7EB'}`, borderRadius:12, padding:'.75rem', background: form[k]?'#F0F7FF':'transparent' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom: form[k]?'.6rem':0 }}>
                    <input type="checkbox" id={k} checked={form[k]}
                      onChange={e => setF(k, e.target.checked)}
                      style={{ width:18, height:18, cursor:'pointer', accentColor:'#2E6DA4' }}/>
                    <label htmlFor={k} style={{ fontWeight:600, fontSize:'.9rem', cursor:'pointer', color: form[k]?'#2E6DA4':'#4B5563' }}>
                      {label}
                    </label>
                  </div>
                  {form[k] && (
                    <div>
                      <label className="label">Límite de crédito</label>
                      <input className="input" type="number" placeholder={`Ej: ${ph}`}
                        value={form[lk]} onChange={e => setF(lk, e.target.value)}/>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Visibilidad */}
          <div className="field">
            <label className="label">Visibilidad</label>
            <div style={{ display:'flex', gap:'.75rem' }}>
              {[{ v:'familiar', l:'👨‍👩‍👧 Familiar', d:'Todos la ven' },{ v:'privada', l:'🔒 Privada', d:'Solo tú' }].map(({ v, l, d }) => (
                <button key={v} type="button" onClick={() => setF('visibilidad', v)} style={{
                  flex:1, padding:'.65rem', borderRadius:10, border:'1.5px solid', cursor:'pointer', textAlign:'center',
                  borderColor: form.visibilidad===v ? '#2E6DA4' : '#E5E7EB',
                  background:  form.visibilidad===v ? '#EEF5FC' : '#fff',
                }}>
                  <p style={{ fontWeight:700, fontSize:'.85rem', color: form.visibilidad===v?'#2E6DA4':'#1F2937' }}>{l}</p>
                  <p style={{ fontSize:'.7rem', color:'#9CA3AF', marginTop:'.1rem' }}>{d}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="field">
            <label className="label">Color de la tarjeta</label>
            <div style={{ display:'flex', gap:'.6rem', flexWrap:'wrap' }}>
              {COLORES.map(c => (
                <button key={c} type="button" onClick={() => setF('color', c)}
                  style={{ width:32, height:32, borderRadius:'50%', background:c, cursor:'pointer',
                    border: form.color===c ? '3px solid #1F2937' : '2px solid #E5E7EB' }}/>
              ))}
            </div>
          </div>

          {error && <div style={S.err}>{error}</div>}

          <div style={{ display:'flex', gap:'.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar tarjeta'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {tarjetas.length === 0 && !showForm ? (
        <div style={S.empty}>
          <CreditCard size={40} color="#9CA3AF"/>
          <p style={{ fontWeight:600 }}>No hay tarjetas registradas</p>
          <p style={{ fontSize:'.875rem', color:'#9CA3AF' }}>Agrega tu primera tarjeta de crédito</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          {tarjetas.map(t => <TarjetaCard key={t.id} tarjeta={t} hideBalances={hideBalances}/>)}
        </div>
      )}
    </div>
  )
}

function TarjetaCard({ tarjeta, hideBalances }) {
  const tieneRDP = Number(tarjeta.limite     || 0) > 0
  const tieneUSD = Number(tarjeta.limite_usd || 0) > 0

  return (
    <div style={{ borderRadius:16, overflow:'hidden', boxShadow:'0 4px 16px rgba(0,0,0,.12)' }}>
      {/* Cabecera visual */}
      <div style={{ background:`linear-gradient(135deg, ${tarjeta.color||'#1E3A5F'}, ${tarjeta.color||'#2E6DA4'}bb)`, padding:'1.25rem', color:'#fff' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
          <div>
            <p style={{ fontSize:'.75rem', opacity:.8, marginBottom:'.15rem' }}>{tarjeta.banco}</p>
            <p style={{ fontWeight:700, fontSize:'1.05rem' }}>{tarjeta.nombre}</p>
          </div>
          <CreditCard size={28} style={{ opacity:.7 }}/>
        </div>

        {/* Saldos — uno o dos según monedas activas */}
        <div style={{ display:'grid', gridTemplateColumns: tieneRDP && tieneUSD ? '1fr 1fr' : '1fr', gap:'.75rem' }}>
          {tieneRDP && (
            <div>
              <p style={{ fontSize:'.68rem', opacity:.75, marginBottom:'.2rem', textTransform:'uppercase', letterSpacing:'.05em' }}>Usado RD$</p>
              <p style={{ fontWeight:800, fontSize: tieneUSD ? '1rem' : '1.3rem' }}>
                {hideBalances ? '••••' : `RD$ ${fmtN(Number(tarjeta.saldo_usado||0))}`}
              </p>
              <p style={{ fontSize:'.72rem', opacity:.8, marginTop:'.1rem' }}>
                Límite: {hideBalances ? '••••' : `RD$ ${fmtN(Number(tarjeta.limite||0))}`}
              </p>
            </div>
          )}
          {tieneUSD && (
            <div style={{ borderLeft: tieneRDP ? '1px solid rgba(255,255,255,.3)' : 'none', paddingLeft: tieneRDP ? '.75rem' : 0 }}>
              <p style={{ fontSize:'.68rem', opacity:.75, marginBottom:'.2rem', textTransform:'uppercase', letterSpacing:'.05em' }}>Usado USD</p>
              <p style={{ fontWeight:800, fontSize: tieneRDP ? '1rem' : '1.3rem' }}>
                {hideBalances ? '••••' : `$ ${fmtN(Number(tarjeta.saldo_usado_usd||0))}`}
              </p>
              <p style={{ fontSize:'.72rem', opacity:.8, marginTop:'.1rem' }}>
                Límite: {hideBalances ? '••••' : `$ ${fmtN(Number(tarjeta.limite_usd||0))}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Barras de progreso */}
      <div style={{ background:'var(--color-card,#fff)', padding:'1rem' }}>
        {tieneRDP && (
          <Barra
            usado={Number(tarjeta.saldo_usado||0)}
            limite={Number(tarjeta.limite||0)}
            label="RD$"/>
        )}
        {tieneUSD && (
          <Barra
            usado={Number(tarjeta.saldo_usado_usd||0)}
            limite={Number(tarjeta.limite_usd||0)}
            label="USD"
            mt={tieneRDP}/>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'.5rem' }}>
          <p style={{ fontSize:'.75rem', color:'#9CA3AF' }}>Corte día {tarjeta.fecha_corte}</p>
          {tarjeta.visibilidad === 'privada' && (
            <span style={{ fontSize:'.7rem', color:'#9CA3AF' }}>🔒 Privada</span>
          )}
        </div>
      </div>
    </div>
  )
}

function Barra({ usado, limite, label, mt }) {
  const pct   = limite > 0 ? Math.min((usado / limite) * 100, 100) : 0
  const color = pct > 80 ? '#DC2626' : pct > 60 ? '#D97706' : '#1B5E35'
  return (
    <div style={{ marginTop: mt ? '.75rem' : 0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.3rem' }}>
        <span style={{ fontSize:'.75rem', color:'#9CA3AF', fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:'.75rem', fontWeight:700, color }}>{pct.toFixed(0)}% usado</span>
      </div>
      <div style={{ height:7, background:'var(--color-card-hover,#F3F4F6)', borderRadius:99 }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:99, transition:'width .4s' }}/>
      </div>
      {pct > 80 && (
        <div style={{ display:'flex', alignItems:'center', gap:'.3rem', marginTop:'.35rem', color:'#DC2626', fontSize:'.72rem' }}>
          <AlertCircle size={12}/> Cerca del límite
        </div>
      )}
    </div>
  )
}

const fmtN = n => Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const S = {
  close: { background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', display:'flex' },
  err:   { background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'.65rem .9rem', fontSize:'.875rem', marginBottom:'.75rem' },
  empty: { display:'flex', flexDirection:'column', alignItems:'center', gap:'.75rem', padding:'3rem 1rem', textAlign:'center' },
}
