import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSheet, appendRow, updateRow, getGastos, getPresupuestos } from '../services/sheets'
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
  const { isAdmin, perfil } = useAuth()
  const [presupuestos, setPresupuestos] = useState([])
  const [gastosDelMes, setGastosDelMes] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [form, setForm] = useState({
    categoria:'', monto_mensual_rdp:'', alerta_80:'true', alerta_100:'true', visibilidad:'familiar',
  })

  const mes = format(new Date(), 'yyyy-MM')

  useEffect(() => { load() }, [perfil])

  async function load() {
    if (!perfil) return
    try {
      const [presData, gastosData] = await Promise.all([
        getSheet('presupuestos'),
        getGastos({ mes }),
      ])
      // Filtrar por visibilidad
      const todos = (presData.rows || []).filter(r => {
        if (r.activo === 'false') return false
        const vis = r.visibilidad || 'familiar'
        if (vis === 'privada') return isAdmin || r.owner_id === perfil?.id
        return true
      })
      setPresupuestos(todos)
      setGastosDelMes(gastosData)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const existe = presupuestos.find(p => p.categoria === form.categoria)
      if (existe) {
        const data = await getSheet('presupuestos')
        const idx  = (data.rows||[]).findIndex(r => r.categoria === form.categoria && r.owner_id === (existe.owner_id||''))
        if (idx !== -1) {
          await updateRow('presupuestos', idx+2, { ...existe,
            monto_mensual_rdp: form.monto_mensual_rdp,
            alerta_80: form.alerta_80, alerta_100: form.alerta_100,
            visibilidad: form.visibilidad, activo:'true' })
        }
      } else {
        await appendRow('presupuestos', {
          id:               'pres_' + Date.now(),
          categoria:        form.categoria,
          monto_mensual_rdp: form.monto_mensual_rdp,
          alerta_80:        form.alerta_80,
          alerta_100:       form.alerta_100,
          activo:           'true',
          visibilidad:      form.visibilidad || 'familiar',
          owner_id:         form.visibilidad === 'privada' ? (perfil?.id||'') : '',
        })
      }
      await load(); setShowForm(false)
      setForm({ categoria:'', monto_mensual_rdp:'', alerta_80:'true', alerta_100:'true', visibilidad:'familiar' })
    } catch { setError('Error al guardar. Intenta de nuevo.') }
    finally { setSaving(false) }
  }

  function gastoCategoria(categoria) {
    return gastosDelMes.filter(g=>g.categoria===categoria).reduce((s,g)=>s+(Number(g.monto_rdp)||0),0)
  }

  const familiares = presupuestos.filter(p => (p.visibilidad||'familiar') !== 'privada')
  const privados   = presupuestos.filter(p => p.visibilidad === 'privada')

  const totalPresupuestado = presupuestos.reduce((s,p)=>s+Number(p.monto_mensual_rdp||0),0)
  const totalGastado = presupuestos.reduce((s,p)=>s+gastoCategoria(p.categoria),0)
  const pctTotal = totalPresupuestado > 0 ? (totalGastado/totalPresupuestado)*100 : 0
  const mesLabel = format(new Date(), 'MMMM yyyy')

  if (loading) return <div className="spinner-center"><div className="spinner"/></div>

  const PresupuestoCard = (p) => {
    const gastado = gastoCategoria(p.categoria)
    const pct     = Number(p.monto_mensual_rdp) > 0 ? (gastado/Number(p.monto_mensual_rdp))*100 : 0
    const color   = pct>=100?'#DC2626':pct>=80?'#D97706':'#1B5E35'
    const bgBar   = pct>=100?'#DC2626':pct>=80?'#F59E0B':'#2E6DA4'
    return (
      <div key={p.id} className="card" style={{ padding:'1rem', marginBottom:'.75rem' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'.75rem',marginBottom:'.75rem' }}>
          <div style={{ fontSize:'1.5rem',width:40,textAlign:'center',flexShrink:0 }}>{CATEG_ICONS[p.categoria]||'💸'}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'.4rem' }}>
                <p style={{ fontWeight:600,fontSize:'.95rem' }}>{p.categoria}</p>
                {p.visibilidad==='privada' && <span style={{ fontSize:'.68rem',background:'var(--color-card-hover,#F3F4F6)',color:'var(--color-text-secondary,#6B7280)',padding:'.1rem .35rem',borderRadius:99 }}>🔒</span>}
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:'.3rem' }}>
                {pct>=100 && <AlertCircle size={16} color="#DC2626"/>}
                {pct<80   && <CheckCircle  size={16} color="#1B5E35"/>}
                {p.alerta_80==='true'?<Bell size={14} color="#9CA3AF"/>:<BellOff size={14} color="#D1D5DB"/>}
              </div>
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:'.78rem',color:'#9CA3AF',marginTop:'.1rem' }}>
              <span>RD$ {fmtN(gastado)} gastado</span>
              <span style={{ fontWeight:700,color }}>{pct.toFixed(0)}% de RD$ {fmtN(Number(p.monto_mensual_rdp))}</span>
            </div>
          </div>
        </div>
        <div style={{ height:8,background:'var(--color-card-hover,#F3F4F6)',borderRadius:99 }}>
          <div style={{ height:'100%',borderRadius:99,width:`${Math.min(pct,100)}%`,background:bgBar }}/>
        </div>
        <p style={{ fontSize:'.75rem',marginTop:'.4rem',color:pct>=100?'#DC2626':'#6B7280' }}>
          {pct>=100?`⚠️ Excedido en RD$ ${fmtN(gastado-Number(p.monto_mensual_rdp))}`:`Disponible: RD$ ${fmtN(Number(p.monto_mensual_rdp)-gastado)}`}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
        <h2 style={{ fontWeight:700 }}>Presupuestos</h2>
        <button className="btn btn-primary" onClick={()=>setShowForm(v=>!v)}><Plus size={16}/> Nuevo</button>
      </div>

      {presupuestos.length > 0 && (
        <div style={S.summaryCard}>
          <div style={{ marginBottom:'.75rem' }}>
            <p style={{ fontSize:'.8rem',color:'rgba(255,255,255,.75)',marginBottom:'.2rem' }}>Resumen {mesLabel}</p>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline' }}>
              <p style={{ fontSize:'1.6rem',fontWeight:800 }}>RD$ {fmtN(totalGastado)}</p>
              <p style={{ fontSize:'.9rem',opacity:.8 }}>de RD$ {fmtN(totalPresupuestado)}</p>
            </div>
          </div>
          <div style={{ height:8,background:'rgba(255,255,255,.25)',borderRadius:99 }}>
            <div style={{ height:'100%',borderRadius:99,width:`${Math.min(pctTotal,100)}%`,
              background:pctTotal>100?'#FCA5A5':pctTotal>80?'#FDE68A':'#BBF7D0' }}/>
          </div>
          <p style={{ fontSize:'.78rem',opacity:.8,marginTop:'.4rem',textAlign:'right' }}>{pctTotal.toFixed(0)}% del total usado</p>
        </div>
      )}

      {showForm && (
        <form className="card" style={{ marginBottom:'1rem' }} onSubmit={handleSubmit}>
          <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
            <h3 style={{ fontWeight:600 }}>Nuevo presupuesto</h3>
            <button type="button" onClick={()=>setShowForm(false)} style={S.closeBtn}><X size={18}/></button>
          </div>
          <div className="field">
            <label className="label">Categoría</label>
            <select className="input" value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} required>
              <option value="">Seleccionar</option>
              {CATEGORIAS.map(c=><option key={c} value={c}>{CATEG_ICONS[c]} {c}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Presupuesto mensual (RD$)</label>
            <input className="input" type="number" placeholder="15000" step="0.01"
              value={form.monto_mensual_rdp} onChange={e=>setForm(f=>({...f,monto_mensual_rdp:e.target.value}))} required/>
          </div>
          {/* Visibilidad */}
          <div className="field">
            <label className="label">Visibilidad</label>
            <div style={{ display:'flex', gap:'.75rem' }}>
              {[{v:'familiar',l:'👨‍👩‍👧 Familiar'},{v:'privada',l:'🔒 Privado'}].map(({v,l}) => (
                <button key={v} type="button" onClick={()=>setForm(f=>({...f,visibilidad:v}))}
                  style={{ flex:1,padding:'.6rem',borderRadius:10,border:'1.5px solid',cursor:'pointer',fontWeight:600,fontSize:'.85rem',textAlign:'center',
                    borderColor:form.visibilidad===v?'#2E6DA4':'#E5E7EB', background:form.visibilidad===v?'#EEF5FC':'#fff',
                    color:form.visibilidad===v?'#2E6DA4':'#4B5563' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:'.5rem',marginBottom:'1rem' }}>
            <label className="label">Alertas por email</label>
            {[{id:'a80',val:'alerta_80',label:'Alertar al 80%'},{id:'a100',val:'alerta_100',label:'Alertar al 100%'}].map(a=>(
              <div key={a.id} style={{ display:'flex',alignItems:'center',gap:'.75rem' }}>
                <input type="checkbox" id={a.id} checked={form[a.val]==='true'}
                  onChange={e=>setForm(f=>({...f,[a.val]:e.target.checked?'true':'false'}))}
                  style={{ width:18,height:18 }}/>
                <label htmlFor={a.id} style={{ fontSize:'.9rem',cursor:'pointer' }}>{a.label}</label>
              </div>
            ))}
          </div>
          {error && <div style={S.errorBox}>{error}</div>}
          <div style={{ display:'flex',gap:'.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
            <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {presupuestos.length === 0 && !showForm ? (
        <div style={S.empty}><Bell size={40} color="#9CA3AF"/><p style={{ fontWeight:600 }}>No hay presupuestos</p></div>
      ) : (
        <>
          {familiares.length > 0 && (
            <div style={{ marginBottom:'1.5rem' }}>
              <p style={S.secLabel}>👨‍👩‍👧 Presupuestos familiares</p>
              {familiares.map(p => PresupuestoCard(p))}
            </div>
          )}
          {privados.length > 0 && (
            <div>
              <p style={S.secLabel}>🔒 Mis presupuestos privados</p>
              {privados.map(p => PresupuestoCard(p))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const fmtN = n => Number(n).toLocaleString('es-DO',{minimumFractionDigits:2})
const S = {
  summaryCard: { background:'linear-gradient(135deg,#1E3A5F,#2E6DA4)',color:'#fff',borderRadius:16,padding:'1.1rem 1.25rem',marginBottom:'1.25rem',boxShadow:'0 6px 20px rgba(30,58,95,.3)' },
  secLabel: { fontSize:'.75rem',fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.5rem' },
  closeBtn: { background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',display:'flex' },
  errorBox: { background:'#FEE2E2',color:'#DC2626',borderRadius:8,padding:'.65rem .9rem',fontSize:'.875rem',marginBottom:'.75rem' },
  empty: { display:'flex',flexDirection:'column',alignItems:'center',gap:'.75rem',padding:'3rem 1rem',textAlign:'center',color:'var(--color-text,#1F2937)' },
}
