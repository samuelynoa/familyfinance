import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { addIngreso, getIngresos, getCuentas, getUsuarios, updateBalance } from '../services/sheets'
import { Plus, X, TrendingUp, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CATEGORIAS = [
  { label: 'Sueldo',      icon: '💼' },
  { label: 'Freelance',   icon: '💻' },
  { label: 'Renta',       icon: '🏠' },
  { label: 'Inversiones', icon: '📈' },
  { label: 'Negocio',     icon: '🏪' },
  { label: 'Bono',        icon: '🎯' },
  { label: 'Regalo',      icon: '🎁' },
  { label: 'Reembolso',   icon: '↩️' },
  { label: 'Otro',        icon: '💰' },
]

export default function Ingresos() {
  const { perfil } = useAuth()
  const [ingresos, setIngresos] = useState([])
  const [cuentas,  setCuentas]  = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')
  const mes = format(new Date(), 'yyyy-MM')

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: '', moneda: 'RD$', categoria: '',
    descripcion: '', usuario_id: '', cuenta_id: '', recurrente: false,
  })

  useEffect(() => { load() }, [perfil])

  async function load() {
    try {
      const [i, c, u] = await Promise.all([getIngresos({ mes }), getCuentas(), getUsuarios()])
      setIngresos(i); setCuentas(c); setUsuarios(u)
      const yo = u.find(u => u.email === perfil?.email)
      if (yo) setForm(f => ({ ...f, usuario_id: yo.id }))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const monto = Number(form.monto)
      if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a cero')
      if (!form.categoria) throw new Error('Selecciona una categoría')
      await addIngreso({
        fecha: form.fecha,
        monto_rdp: form.moneda === 'RD$' ? monto : null,
        monto_usd: form.moneda === 'USD' ? monto : null,
        categoria: form.categoria, usuario_id: form.usuario_id,
        cuenta_id: form.cuenta_id, descripcion: form.descripcion,
        recurrente: form.recurrente,
      })
      if (form.cuenta_id) {
        const cuenta = cuentas.find(c => c.id === form.cuenta_id)
        if (cuenta && cuenta.solo_consulta !== 'true')
          await updateBalance(form.cuenta_id, Number(cuenta.balance || 0) + monto)
      }
      setSaved(true)
      setTimeout(() => { setSaved(false); setShowForm(false); setForm(f => ({ ...f, monto: '', descripcion: '', categoria: '', cuenta_id: '' })); load() }, 1200)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const totalMes   = ingresos.reduce((s, i) => s + (Number(i.monto_rdp) || 0), 0)
  const usuarioMap = Object.fromEntries(usuarios.map(u => [u.id, u]))
  const cuentasOp  = cuentas.filter(c => c.solo_consulta !== 'true')
  const mesLabel   = format(new Date(), 'MMMM yyyy', { locale: es })

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700 }}>Ingresos</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={16} /> Nuevo</button>
      </div>

      <div style={S.summaryCard}>
        <TrendingUp size={22} color="#fff" style={{ opacity: .8 }} />
        <div>
          <p style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.75)' }}>Ingresos {mesLabel}</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>RD$ {fmtN(totalMes)}</p>
        </div>
      </div>

      {showForm && (
        <form className="card" style={{ marginBottom: '1rem' }} onSubmit={handleSubmit}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 600 }}>Nuevo ingreso</h3>
            <button type="button" onClick={() => setShowForm(false)} style={S.closeBtn}><X size={18} /></button>
          </div>
          {saved && <div style={{ display:'flex',alignItems:'center',gap:'.5rem',color:'#1B5E35',background:'#D4EDDA',padding:'.65rem 1rem',borderRadius:8,marginBottom:'.75rem' }}><CheckCircle size={18}/>¡Registrado!</div>}
          <div className="field">
            <label className="label">Monto</label>
            <div style={{ display:'flex',gap:'.5rem' }}>
              <select className="input" style={{ width:90,flexShrink:0 }} value={form.moneda} onChange={e=>setF('moneda',e.target.value)}>
                <option value="RD$">RD$</option><option value="USD">USD</option>
              </select>
              <input className="input" type="number" placeholder="0.00" step="0.01" min="0.01"
                value={form.monto} onChange={e=>setF('monto',e.target.value)} required style={{ fontSize:'1.1rem',fontWeight:700 }} />
            </div>
          </div>
          <div className="field">
            <label className="label">Categoría</label>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'.5rem' }}>
              {CATEGORIAS.map(c => (
                <button key={c.label} type="button" onClick={()=>setF('categoria',c.label)} style={{
                  padding:'.55rem .3rem',borderRadius:10,border:'1.5px solid',cursor:'pointer',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:'.2rem',
                  borderColor: form.categoria===c.label?'#1B5E35':'#E5E7EB',
                  background:  form.categoria===c.label?'#D4EDDA':'#fff',
                }}>
                  <span style={{ fontSize:'1.2rem' }}>{c.icon}</span>
                  <span style={{ fontSize:'.65rem',fontWeight:600,color:form.categoria===c.label?'#1B5E35':'#4B5563' }}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="label">Fecha</label>
              <input className="input" type="date" value={form.fecha} onChange={e=>setF('fecha',e.target.value)} />
            </div>
            <div className="field">
              <label className="label">¿Quién?</label>
              <select className="input" value={form.usuario_id} onChange={e=>setF('usuario_id',e.target.value)}>
                <option value="">Seleccionar</option>
                {usuarios.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label">Descripción</label>
            <input className="input" placeholder="Ej: Sueldo enero, Proyecto web..." value={form.descripcion} onChange={e=>setF('descripcion',e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Acreditar a cuenta (opcional)</label>
            <select className="input" value={form.cuenta_id} onChange={e=>setF('cuenta_id',e.target.value)}>
              <option value="">No acreditar</option>
              {cuentasOp.map(c=><option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}
            </select>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:'.75rem',marginBottom:'1rem' }}>
            <input type="checkbox" id="rec" checked={form.recurrente} onChange={e=>setF('recurrente',e.target.checked)} style={{ width:18,height:18 }} />
            <label htmlFor="rec" style={{ fontSize:'.9rem',cursor:'pointer' }}>Ingreso recurrente mensual</label>
          </div>
          {error && <div style={S.errorBox}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={saving} style={{ padding:'.9rem' }}>
            {saving?'Guardando...':'✓ Registrar ingreso'}
          </button>
        </form>
      )}

      {ingresos.length === 0 && !showForm ? (
        <div style={S.empty}><TrendingUp size={40} color="#9CA3AF" /><p style={{ fontWeight:600 }}>No hay ingresos este mes</p></div>
      ) : (
        <div className="card" style={{ padding:0,overflow:'hidden' }}>
          {[...ingresos].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map((ing,i,arr)=>{
            const usuario = usuarioMap[ing.usuario_id]
            const cat = CATEGORIAS.find(c=>c.label===ing.categoria)
            return (
              <div key={ing.id||i} style={{ display:'flex',alignItems:'center',gap:'.85rem',padding:'.85rem 1rem',borderBottom:i<arr.length-1?'1px solid #F3F4F6':'none' }}>
                <div style={{ width:42,height:42,borderRadius:12,background:'#D4EDDA',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',flexShrink:0 }}>{cat?.icon||'💰'}</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:600,fontSize:'.9rem' }}>{ing.descripcion||ing.categoria}</p>
                  <p style={{ fontSize:'.75rem',color:'#9CA3AF' }}>{ing.categoria}{usuario?` · ${usuario.nombre.split(' ')[0]}`:''}{ing.recurrente==='true'?' · 🔄':''}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontWeight:700,color:'#1B5E35',fontSize:'.9rem' }}>+{ing.monto_rdp?`RD$${fmtN(Number(ing.monto_rdp))}`:`$${fmtN(Number(ing.monto_usd))}`}</p>
                  <p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>{ing.fecha}</p>
                </div>
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
  summaryCard: { background:'linear-gradient(135deg,#1B5E35,#2E7D52)',color:'#fff',borderRadius:16,padding:'1.1rem 1.25rem',marginBottom:'1.25rem',display:'flex',alignItems:'center',gap:'1rem',boxShadow:'0 6px 20px rgba(27,94,53,.3)' },
  closeBtn: { background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',display:'flex' },
  errorBox: { background:'#FEE2E2',color:'#DC2626',borderRadius:8,padding:'.65rem .9rem',fontSize:'.875rem',marginBottom:'.75rem' },
  empty: { display:'flex',flexDirection:'column',alignItems:'center',gap:'.75rem',padding:'3rem 1rem',textAlign:'center',color:'#1F2937' },
}
