import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getPrestamos, addPrestamo, updatePrestamo } from '../services/sheets'
import { Plus, X, ChevronDown, ChevronUp, TrendingDown, DollarSign, Pencil } from 'lucide-react'

const FORM_VACIO = { nombre:'', capital_original:'', tasa_anual:'', cuota_mensual:'',
  fecha_inicio: new Date().toISOString().split('T')[0], fecha_vencimiento:'', visibilidad:'familiar' }

export default function Prestamos() {
  const { isAdmin, perfil } = useAuth()
  const [prestamos, setPrestamos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editando,  setEditando]  = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [expandId,  setExpandId]  = useState(null)
  const [form, setForm] = useState(FORM_VACIO)

  useEffect(() => { load() }, [perfil])

  async function load() {
    if (!perfil) return
    try { setPrestamos(await getPrestamos({ usuarioId: perfil.id, isAdmin })) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function abrirNueva() { setEditando(null); setForm(FORM_VACIO); setError(''); setShowForm(true) }
  function abrirEditar(p) {
    setEditando(p)
    setForm({ nombre:p.nombre, capital_original:p.capital_original, tasa_anual:p.tasa_anual||'',
      cuota_mensual:p.cuota_mensual, fecha_inicio:p.fecha_inicio||'',
      fecha_vencimiento:p.fecha_vencimiento||'', visibilidad:p.visibilidad||'familiar' })
    setError(''); setShowForm(true); setExpandId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      if (editando) {
        await updatePrestamo(editando.id, { ...editando, nombre:form.nombre, tasa_anual:form.tasa_anual,
          cuota_mensual:form.cuota_mensual, fecha_inicio:form.fecha_inicio,
          fecha_vencimiento:form.fecha_vencimiento, visibilidad:form.visibilidad })
      } else {
        await addPrestamo({ ...form, owner_id: perfil?.id || '' })
      }
      await load(); setShowForm(false); setEditando(null); setForm(FORM_VACIO)
    } catch { setError('Error al guardar. Intenta de nuevo.') }
    finally { setSaving(false) }
  }

  function calcularAmortizacion(p) {
    const capital = Number(p.capital_pendiente||0)
    const tasaMens = Number(p.tasa_anual||0)/100/12
    const cuota = Number(p.cuota_mensual||0)
    if (!cuota || !capital) return []
    const filas = []
    let saldo = capital
    for (let i = 1; i <= 12 && saldo > 0; i++) {
      const interes = saldo * tasaMens
      const capitalPag = Math.min(cuota - interes, saldo)
      saldo -= capitalPag
      filas.push({ mes:i, cuota:cuota.toFixed(2), interes:interes.toFixed(2), capital:capitalPag.toFixed(2), saldo:Math.max(saldo,0).toFixed(2) })
    }
    return filas
  }

  const familiares = prestamos.filter(p => (p.visibilidad||'familiar') !== 'privada')
  const privados   = prestamos.filter(p => p.visibilidad === 'privada')
  const totalPendiente = prestamos.reduce((s,p) => s + Number(p.capital_pendiente||0), 0)

  if (loading) return <div className="spinner-center"><div className="spinner"/></div>

  const FormularioPrestamo = (
    <form className="card" style={{ marginBottom:'1rem' }} onSubmit={handleSubmit}>
      <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
        <h3 style={{ fontWeight:600 }}>{editando?'Editar préstamo':'Nuevo préstamo'}</h3>
        <button type="button" onClick={()=>{setShowForm(false);setEditando(null)}} style={S.closeBtn}><X size={18}/></button>
      </div>
      <div className="field">
        <label className="label">Nombre</label>
        <input className="input" placeholder="Ej: Hipoteca BHD"
          value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} required/>
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="label">Capital original (RD$)</label>
          <input className="input" type="number" placeholder="500000" step="0.01"
            value={form.capital_original} onChange={e=>setForm(f=>({...f,capital_original:e.target.value}))}
            required disabled={!!editando}/>
        </div>
        <div className="field">
          <label className="label">Tasa anual (%)</label>
          <input className="input" type="number" placeholder="14.5" step="0.01"
            value={form.tasa_anual} onChange={e=>setForm(f=>({...f,tasa_anual:e.target.value}))}/>
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="label">Cuota mensual (RD$)</label>
          <input className="input" type="number" placeholder="15000" step="0.01"
            value={form.cuota_mensual} onChange={e=>setForm(f=>({...f,cuota_mensual:e.target.value}))} required/>
        </div>
        <div className="field">
          <label className="label">Fecha inicio</label>
          <input className="input" type="date" value={form.fecha_inicio} onChange={e=>setForm(f=>({...f,fecha_inicio:e.target.value}))}/>
        </div>
      </div>
      <div className="field">
        <label className="label">Fecha vencimiento</label>
        <input className="input" type="date" value={form.fecha_vencimiento} onChange={e=>setForm(f=>({...f,fecha_vencimiento:e.target.value}))}/>
      </div>
      {/* Visibilidad */}
      <div className="field">
        <label className="label">Visibilidad</label>
        <div style={{ display:'flex', gap:'.75rem' }}>
          {[{v:'familiar',l:'👨‍👩‍👧 Familiar'},{v:'privada',l:'🔒 Privado'}].map(({v,l}) => (
            <button key={v} type="button" onClick={()=>setForm(f=>({...f,visibilidad:v}))}
              style={{ flex:1, padding:'.6rem', borderRadius:10, border:'1.5px solid', cursor:'pointer',
                fontWeight:600, fontSize:'.85rem', textAlign:'center',
                borderColor:form.visibilidad===v?'#2E6DA4':'#E5E7EB',
                background:form.visibilidad===v?'#EEF5FC':'#fff',
                color:form.visibilidad===v?'#2E6DA4':'#4B5563' }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {error && <div style={S.errorBox}>{error}</div>}
      <div style={{ display:'flex', gap:'.75rem' }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Guardando...':editando?'Guardar cambios':'Guardar'}</button>
        <button type="button" className="btn btn-secondary" onClick={()=>{setShowForm(false);setEditando(null)}}>Cancelar</button>
      </div>
    </form>
  )

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
        <h2 style={{ fontWeight:700 }}>Préstamos</h2>
        <button className="btn btn-primary" onClick={abrirNueva}><Plus size={16}/> Nuevo</button>
      </div>

      {prestamos.length > 0 && (
        <div style={S.summaryCard}>
          <TrendingDown size={22} color="#fff" style={{ opacity:.8 }}/>
          <div>
            <p style={{ fontSize:'.78rem',color:'rgba(255,255,255,.75)' }}>Total deuda pendiente</p>
            <p style={{ fontSize:'1.5rem',fontWeight:800 }}>RD$ {fmtN(totalPendiente)}</p>
          </div>
        </div>
      )}

      {showForm && FormularioPrestamo}

      {prestamos.length === 0 && !showForm ? (
        <div style={S.empty}><DollarSign size={40} color="#9CA3AF"/><p style={{ fontWeight:600 }}>No hay préstamos</p></div>
      ) : (
        <>
          {familiares.length > 0 && (
            <div style={{ marginBottom:'1.5rem' }}>
              <p style={S.secLabel}>👨‍👩‍👧 Préstamos familiares</p>
              {familiares.map(p => <PrestamoCard key={p.id} p={p} expanded={expandId===p.id}
                amort={expandId===p.id?calcularAmortizacion(p):[]}
                onToggle={()=>setExpandId(expandId===p.id?null:p.id)}
                onEdit={()=>abrirEditar(p)} puedeEditar={isAdmin||p.owner_id===perfil?.id}/>)}
            </div>
          )}
          {privados.length > 0 && (
            <div>
              <p style={S.secLabel}>🔒 Mis préstamos privados</p>
              {privados.map(p => <PrestamoCard key={p.id} p={p} expanded={expandId===p.id}
                amort={expandId===p.id?calcularAmortizacion(p):[]}
                onToggle={()=>setExpandId(expandId===p.id?null:p.id)}
                onEdit={()=>abrirEditar(p)} puedeEditar={true}/>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PrestamoCard({ p, expanded, amort, onToggle, onEdit, puedeEditar }) {
  const pct = Number(p.capital_original) > 0
    ? ((Number(p.capital_original) - Number(p.capital_pendiente)) / Number(p.capital_original)) * 100 : 0
  return (
    <div className="card" style={{ padding:0,overflow:'hidden',marginBottom:'.75rem' }}>
      <div style={{ padding:'1rem', cursor:'pointer' }}>
        <div className="flex justify-between items-center" style={{ marginBottom:'.75rem' }}>
          <div onClick={onToggle} style={{ flex:1 }}>
            <div style={{ display:'flex',alignItems:'center',gap:'.5rem' }}>
              <p style={{ fontWeight:700 }}>{p.nombre}</p>
              {p.visibilidad==='privada' && <span style={{ fontSize:'.68rem',background:'var(--color-card-hover,#F3F4F6)',color:'var(--color-text-secondary,#6B7280)',padding:'.15rem .4rem',borderRadius:99 }}>🔒</span>}
            </div>
            <p style={{ fontSize:'.78rem',color:'#9CA3AF' }}>Tasa: {p.tasa_anual}% · Cuota: RD$ {fmtN(Number(p.cuota_mensual))}</p>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:'.4rem' }}>
            {puedeEditar && <button onClick={onEdit} style={S.iconBtn}><Pencil size={15} color="#2E6DA4"/></button>}
            <button onClick={onToggle} style={S.iconBtn}>{expanded?<ChevronUp size={18} color="#9CA3AF"/>:<ChevronDown size={18} color="#9CA3AF"/>}</button>
          </div>
        </div>
        <div onClick={onToggle}>
          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'.3rem' }}>
            <span style={{ fontSize:'.78rem',color:'#9CA3AF' }}>Pagado: RD$ {fmtN(Number(p.capital_original)-Number(p.capital_pendiente))}</span>
            <span style={{ fontSize:'.78rem',fontWeight:700,color:'#2E6DA4' }}>{pct.toFixed(0)}%</span>
          </div>
          <div style={{ height:8,background:'var(--color-card-hover,#F3F4F6)',borderRadius:99 }}>
            <div style={{ height:'100%',width:`${pct}%`,background:'#2E6DA4',borderRadius:99 }}/>
          </div>
          <div className="grid-2" style={{ marginTop:'.75rem' }}>
            <div style={S.statBox}><p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>Capital pendiente</p><p style={{ fontWeight:700,color:'#DC2626' }}>RD$ {fmtN(Number(p.capital_pendiente))}</p></div>
            <div style={S.statBox}><p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>Vence</p><p style={{ fontWeight:700 }}>{p.fecha_vencimiento||'—'}</p></div>
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop:'1px solid var(--color-border-secondary,#F3F4F6)' }}>
          <p style={{ fontSize:'.72rem',fontWeight:700,color:'#9CA3AF',padding:'.6rem 1rem .3rem',textTransform:'uppercase' }}>Próximas 12 cuotas</p>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'.78rem' }}>
              <thead><tr style={{ background:'var(--color-card-hover,#F9FAFB)' }}>
                {['Mes','Cuota','Interés','Capital','Saldo'].map(h=><th key={h} style={{ padding:'.5rem .75rem',textAlign:'right',color:'var(--color-text-secondary,#6B7280)',fontWeight:600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {amort.map((f,i)=>(
                  <tr key={i} style={{ borderTop:'1px solid var(--color-border-secondary,#F3F4F6)',background:i%2===0?'#fff':'#FAFAFA' }}>
                    <td style={{ padding:'.5rem .75rem',textAlign:'right',color:'var(--color-text-secondary,#6B7280)' }}>{f.mes}</td>
                    <td style={{ padding:'.5rem .75rem',textAlign:'right',fontWeight:600 }}>{fmtN(Number(f.cuota))}</td>
                    <td style={{ padding:'.5rem .75rem',textAlign:'right',color:'#DC2626' }}>{fmtN(Number(f.interes))}</td>
                    <td style={{ padding:'.5rem .75rem',textAlign:'right',color:'#1B5E35' }}>{fmtN(Number(f.capital))}</td>
                    <td style={{ padding:'.5rem .75rem',textAlign:'right',fontWeight:600 }}>{fmtN(Number(f.saldo))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const fmtN = n => Number(n).toLocaleString('es-DO',{minimumFractionDigits:2})
const S = {
  summaryCard: { background:'linear-gradient(135deg,#B91C1C,#DC2626)',color:'#fff',borderRadius:16,padding:'1.1rem 1.25rem',marginBottom:'1.25rem',display:'flex',alignItems:'center',gap:'1rem',boxShadow:'0 6px 20px rgba(185,28,28,.3)' },
  statBox: { background:'var(--color-card-hover,#F9FAFB)',borderRadius:10,padding:'.6rem .75rem' },
  secLabel: { fontSize:'.75rem',fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.5rem' },
  closeBtn: { background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',display:'flex' },
  iconBtn:  { background:'none',border:'none',cursor:'pointer',display:'flex',padding:'.2rem' },
  errorBox: { background:'#FEE2E2',color:'#DC2626',borderRadius:8,padding:'.65rem .9rem',fontSize:'.875rem',marginBottom:'.75rem' },
  empty: { display:'flex',flexDirection:'column',alignItems:'center',gap:'.75rem',padding:'3rem 1rem',textAlign:'center' },
}
