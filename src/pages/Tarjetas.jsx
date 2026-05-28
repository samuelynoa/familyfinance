import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getTarjetas, addTarjeta, updateTarjeta } from '../services/sheets'
import { CreditCard, Plus, X, AlertCircle, Pencil } from 'lucide-react'

const COLORES = ['#1E3A5F','#B91C1C','#1B5E35','#5B21B6','#7A4800','#0E7490']
const VIS_BTN = (form, setForm) => (
  <div className="field">
    <label className="label">Visibilidad</label>
    <div style={{ display:'flex', gap:'.75rem' }}>
      {[{v:'familiar',l:'👨‍👩‍👧 Familiar'},{v:'privada',l:'🔒 Privada'}].map(({v,l}) => (
        <button key={v} type="button" onClick={() => setForm(f=>({...f,visibilidad:v}))}
          style={{ flex:1, padding:'.6rem', borderRadius:10, border:'1.5px solid', cursor:'pointer', fontWeight:600, fontSize:'.85rem', textAlign:'center',
            borderColor: form.visibilidad===v?'#2E6DA4':'#E5E7EB', background: form.visibilidad===v?'#EEF5FC':'#fff',
            color: form.visibilidad===v?'#2E6DA4':'#4B5563' }}>
          {l}
        </button>
      ))}
    </div>
  </div>
)

const FORM_VACIO = { nombre:'', banco:'', limite:'', moneda:'RD$', fecha_corte:'25', color:COLORES[0], visibilidad:'familiar' }

export default function Tarjetas() {
  const { isAdmin, perfil } = useAuth()
  const [tarjetas, setTarjetas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [form, setForm] = useState(FORM_VACIO)

  useEffect(() => { load() }, [perfil])

  async function load() {
    if (!perfil) return
    try { setTarjetas(await getTarjetas({ usuarioId: perfil.id, isAdmin })) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function abrirNueva() { setEditando(null); setForm(FORM_VACIO); setError(''); setShowForm(true) }
  function abrirEditar(t) {
    setEditando(t)
    setForm({ nombre:t.nombre, banco:t.banco||'', limite:t.limite, moneda:t.moneda||'RD$',
      fecha_corte:t.fecha_corte||'25', color:t.color||COLORES[0], visibilidad:t.visibilidad||'familiar' })
    setError(''); setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      if (editando) {
        await updateTarjeta(editando.id, { ...editando, ...form, visibilidad: form.visibilidad, owner_id: editando.owner_id || perfil?.id || '' })
      } else {
        await addTarjeta({ ...form, owner_id: perfil?.id || '' })
      }
      await load(); setShowForm(false); setEditando(null); setForm(FORM_VACIO)
    } catch { setError('Error al guardar. Intenta de nuevo.') }
    finally { setSaving(false) }
  }

  const familiares = tarjetas.filter(t => (t.visibilidad||'familiar') !== 'privada')
  const privadas   = tarjetas.filter(t => t.visibilidad === 'privada')

  if (loading) return <div className="spinner-center"><div className="spinner"/></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
        <h2 style={{ fontWeight:700 }}>Tarjetas de crédito</h2>
        <button className="btn btn-primary" onClick={abrirNueva}><Plus size={16}/> Nueva</button>
      </div>

      {showForm && (
        <form className="card" style={{ marginBottom:'1rem' }} onSubmit={handleSubmit}>
          <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
            <h3 style={{ fontWeight:600 }}>{editando?'Editar tarjeta':'Nueva tarjeta'}</h3>
            <button type="button" onClick={()=>{setShowForm(false);setEditando(null)}} style={S.closeBtn}><X size={18}/></button>
          </div>
          <div className="field">
            <label className="label">Nombre</label>
            <input className="input" placeholder="Ej: Visa BanReservas"
              value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} required/>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="label">Banco</label>
              <input className="input" placeholder="BanReservas" value={form.banco} onChange={e=>setForm(f=>({...f,banco:e.target.value}))}/>
            </div>
            <div className="field">
              <label className="label">Moneda</label>
              <select className="input" value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value}))}>
                <option value="RD$">RD$</option><option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="label">Límite</label>
              <input className="input" type="number" placeholder="150000" step="0.01"
                value={form.limite} onChange={e=>setForm(f=>({...f,limite:e.target.value}))} required/>
            </div>
            <div className="field">
              <label className="label">Día de corte</label>
              <input className="input" type="number" min="1" max="31" placeholder="25"
                value={form.fecha_corte} onChange={e=>setForm(f=>({...f,fecha_corte:e.target.value}))}/>
            </div>
          </div>
          {VIS_BTN(form, setForm)}
          <div className="field">
            <label className="label">Color</label>
            <div style={{ display:'flex', gap:'.5rem' }}>
              {COLORES.map(c=>(
                <button key={c} type="button" onClick={()=>setForm(f=>({...f,color:c}))}
                  style={{ width:30,height:30,borderRadius:'50%',background:c,cursor:'pointer',
                    border:form.color===c?'3px solid #1F2937':'2px solid #E5E7EB' }}/>
              ))}
            </div>
          </div>
          {error && <div style={S.errorBox}>{error}</div>}
          <div style={{ display:'flex', gap:'.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Guardando...':editando?'Guardar cambios':'Crear tarjeta'}</button>
            <button type="button" className="btn btn-secondary" onClick={()=>{setShowForm(false);setEditando(null)}}>Cancelar</button>
          </div>
        </form>
      )}

      {tarjetas.length === 0 && !showForm ? (
        <div style={S.empty}><CreditCard size={40} color="#9CA3AF"/><p style={{ fontWeight:600 }}>No hay tarjetas registradas</p></div>
      ) : (
        <>
          {familiares.length > 0 && (
            <div style={{ marginBottom:'1.5rem' }}>
              <p style={S.secLabel}>👨‍👩‍👧 Tarjetas familiares</p>
              {familiares.map(t=><TarjetaCard key={t.id} tarjeta={t} onEdit={()=>abrirEditar(t)} puedeEditar={isAdmin||t.owner_id===perfil?.id}/>)}
            </div>
          )}
          {privadas.length > 0 && (
            <div>
              <p style={S.secLabel}>🔒 Mis tarjetas privadas</p>
              {privadas.map(t=><TarjetaCard key={t.id} tarjeta={t} onEdit={()=>abrirEditar(t)} puedeEditar={true}/>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TarjetaCard({ tarjeta: t, onEdit, puedeEditar }) {
  const limite = Number(t.limite||0), usado = Number(t.saldo_usado||0)
  const disponible = limite - usado
  const pct = limite > 0 ? Math.min((usado/limite)*100, 100) : 0
  const color = pct>80?'#DC2626':pct>60?'#7A4800':'#1B5E35'
  return (
    <div style={{ borderRadius:16, overflow:'hidden', boxShadow:'0 4px 12px rgba(0,0,0,.12)', marginBottom:'1rem' }}>
      <div style={{ background:`linear-gradient(135deg,${t.color||'#1E3A5F'},${t.color||'#2E6DA4'}cc)`, padding:'1.25rem', color:'#fff' }}>
        <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
          <div>
            <p style={{ fontSize:'.75rem',opacity:.8 }}>{t.banco}</p>
            <p style={{ fontWeight:700,fontSize:'1.05rem' }}>{t.nombre}</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
            {t.visibilidad==='privada' && <span style={{ fontSize:'.7rem',background:'rgba(0,0,0,.25)',padding:'.2rem .5rem',borderRadius:99 }}>🔒 Privada</span>}
            {puedeEditar && <button onClick={onEdit} style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:8,padding:'.35rem',cursor:'pointer',color:'#fff',display:'flex' }}><Pencil size={14}/></button>}
            <CreditCard size={24} style={{ opacity:.8 }}/>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div><p style={{ fontSize:'.72rem',opacity:.75 }}>Saldo usado</p><p style={{ fontWeight:800,fontSize:'1.2rem' }}>{t.moneda==='USD'?'$':'RD$'} {fmtN(usado)}</p></div>
          <div style={{ textAlign:'right' }}><p style={{ fontSize:'.72rem',opacity:.75 }}>Disponible</p><p style={{ fontWeight:700,fontSize:'1rem' }}>{t.moneda==='USD'?'$':'RD$'} {fmtN(disponible)}</p></div>
        </div>
      </div>
      <div style={{ background:'#fff', padding:'1rem' }}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'.4rem' }}>
          <span style={{ fontSize:'.78rem',color:'#9CA3AF' }}>Límite: {t.moneda==='USD'?'$':'RD$'} {fmtN(limite)}</span>
          <span style={{ fontSize:'.78rem',fontWeight:700,color }}>{pct.toFixed(0)}% usado</span>
        </div>
        <div style={{ height:6,background:'#F3F4F6',borderRadius:99 }}>
          <div style={{ height:'100%',width:`${pct}%`,background:color,borderRadius:99 }}/>
        </div>
        {pct>80 && <div style={{ display:'flex',alignItems:'center',gap:'.35rem',marginTop:'.5rem',color:'#DC2626',fontSize:'.78rem' }}><AlertCircle size={14}/> Cerca del límite</div>}
        <p style={{ fontSize:'.75rem',color:'#9CA3AF',marginTop:'.4rem' }}>Corte día {t.fecha_corte} · {t.moneda}</p>
      </div>
    </div>
  )
}

const fmtN = n => Math.abs(Number(n)).toLocaleString('es-DO',{minimumFractionDigits:2})
const S = {
  closeBtn: { background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',display:'flex' },
  errorBox: { background:'#FEE2E2',color:'#DC2626',borderRadius:8,padding:'.65rem .9rem',fontSize:'.875rem',marginBottom:'.75rem' },
  empty: { display:'flex',flexDirection:'column',alignItems:'center',gap:'.75rem',padding:'3rem 1rem',textAlign:'center' },
  secLabel: { fontSize:'.75rem',fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.5rem' },
}
