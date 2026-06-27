import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getCuentas, getTarjetas, addIngreso, addTransferencia,
  pagarTarjeta, updateBalance, getSheet, updateRow,
} from '../../services/sheets'
import { Plus, X, TrendingDown, TrendingUp, ArrowLeftRight, CreditCard, CheckCircle } from 'lucide-react'

const CATEGORIAS_INGRESO = [
  { label:'Sueldo',icon:'💼' },{ label:'Freelance',icon:'💻' },
  { label:'Renta',icon:'🏠' },{ label:'Inversiones',icon:'📈' },
  { label:'Negocio',icon:'🏪' },{ label:'Bono',icon:'🎯' },
  { label:'Regalo',icon:'🎁' },{ label:'Reembolso',icon:'↩️' },
  { label:'Otro',icon:'💰' },
]

const FORM_ING = {
  monto:'', moneda:'RD$', categoria:'', descripcion:'',
  fecha: new Date().toISOString().split('T')[0],
  cuenta_id:'', visibilidad:'privada',
}
const FORM_TRANS = {
  monto:'', origen_id:'', destino_id:'',
  descripcion:'', fecha: new Date().toISOString().split('T')[0],
}
const FORM_PAGO = {
  tarjeta_id:'', monto:'', moneda:'RD$', cuenta_id:'',
  fecha: new Date().toISOString().split('T')[0], descripcion:'',
}

export default function SpeedDial() {
  const { perfil, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [open,     setOpen]     = useState(false)
  const [modal,    setModal]    = useState(null) // 'ingreso' | 'transfer' | 'pago'
  const [cuentas,  setCuentas]  = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [loadData, setLoadData] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState('')
  const [formIng,  setFormIng]  = useState(FORM_ING)
  const [formTrans,setFormTrans]= useState(FORM_TRANS)
  const [formPago, setFormPago] = useState(FORM_PAGO)
  const overlayRef = useRef(null)

  // Cerrar al tocar fuera
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (overlayRef.current && e.target === overlayRef.current) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Cargar cuentas/tarjetas al abrir un modal
  async function abrirModal(tipo) {
    setModal(tipo); setOpen(false); setError(''); setDone(false)
    if (!loadData) {
      setLoadData(true)
      try {
        const [c, t] = await Promise.all([
          getCuentas({ usuarioId: perfil?.id, isAdmin }),
          getTarjetas({ usuarioId: perfil?.id, isAdmin }),
        ])
        setCuentas(c); setTarjetas(t)
      } catch (e) { console.error(e) }
    }
  }

  function cerrarModal() { setModal(null); setDone(false); setError('') }
  function resetDone()   { setDone(false) }

  // ── Ingreso ──────────────────────────────────────────────────────────────────
  async function handleIngreso(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const monto = Number(formIng.monto)
      if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a cero')
      if (!formIng.categoria)   throw new Error('Selecciona una categoría')
      await addIngreso({
        fecha:       formIng.fecha,
        monto_rdp:   formIng.moneda === 'RD$' ? monto : null,
        monto_usd:   formIng.moneda === 'USD' ? monto : null,
        categoria:   formIng.categoria,
        descripcion: formIng.descripcion,
        usuario_id:  perfil?.id,
        cuenta_id:   formIng.cuenta_id,
        visibilidad: formIng.visibilidad,
        owner_id:    perfil?.id,
        recurrente:  false,
      })
      if (formIng.cuenta_id) {
        const c = cuentas.find(x => x.id === formIng.cuenta_id)
        if (c) await updateBalance(formIng.cuenta_id, Number(c.balance || 0) + monto)
      }
      setDone(true)
      setTimeout(() => { cerrarModal(); setFormIng(FORM_ING) }, 1200)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  // ── Transferencia ────────────────────────────────────────────────────────────
  async function handleTransfer(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const monto = Number(formTrans.monto)
      if (!monto || monto <= 0)           throw new Error('El monto debe ser mayor a cero')
      if (!formTrans.origen_id)           throw new Error('Selecciona la cuenta de origen')
      if (!formTrans.destino_id)          throw new Error('Selecciona la cuenta de destino')
      if (formTrans.origen_id === formTrans.destino_id) throw new Error('Origen y destino deben ser diferentes')

      const origen  = cuentas.find(c => c.id === formTrans.origen_id)
      const destino = cuentas.find(c => c.id === formTrans.destino_id)
      if (monto > Number(origen?.balance || 0)) throw new Error(`Saldo insuficiente. Disponible: RD$ ${fmtN(Number(origen?.balance || 0))}`)

      await Promise.all([
        updateBalance(formTrans.origen_id, Number(origen.balance) - monto),
        updateBalance(formTrans.destino_id, Number(destino.balance || 0) + monto),
      ])
      await addTransferencia({
        fecha:             formTrans.fecha,
        cuenta_origen_id:  formTrans.origen_id,
        cuenta_destino_id: formTrans.destino_id,
        monto, moneda: origen?.moneda || 'RD$',
        tipo:              'transferencia',
        descripcion:       formTrans.descripcion || `${origen?.nombre} → ${destino?.nombre}`,
        usuario_id:        perfil?.id,
      })
      setDone(true)
      setTimeout(() => { cerrarModal(); setFormTrans(FORM_TRANS) }, 1200)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  // ── Pago tarjeta ─────────────────────────────────────────────────────────────
  async function handlePago(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const monto = Number(formPago.monto)
      if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a cero')
      if (!formPago.tarjeta_id) throw new Error('Selecciona la tarjeta')

      const tarjeta = tarjetas.find(t => t.id === formPago.tarjeta_id)
      const maxRDP  = Number(tarjeta?.saldo_usado     || 0)
      const maxUSD  = Number(tarjeta?.saldo_usado_usd || 0)
      if (formPago.moneda === 'RD$' && monto > maxRDP) throw new Error(`Excede el saldo usado (RD$ ${fmtN(maxRDP)})`)
      if (formPago.moneda === 'USD' && monto > maxUSD) throw new Error(`Excede el saldo usado ($ ${fmtN(maxUSD)})`)

      await pagarTarjeta({
        tarjetaId:   formPago.tarjeta_id,
        cuentaId:    formPago.cuenta_id || null,
        montoRDP:    formPago.moneda === 'RD$' ? monto : null,
        montoUSD:    formPago.moneda === 'USD' ? monto : null,
        fecha:       formPago.fecha,
        descripcion: formPago.descripcion || `Pago ${tarjeta?.nombre}`,
        usuarioId:   perfil?.id,
      })
      setDone(true)
      setTimeout(() => { cerrarModal(); setFormPago(FORM_PAGO) }, 1200)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const ACTIONS = [
    { key:'gasto',    label:'Gasto',         icon:'💸', color:'#DC2626', bg:'#FEE2E2', action: () => { setOpen(false); navigate('/gastos/nuevo') } },
    { key:'ingreso',  label:'Ingreso',        icon:'💰', color:'#1B5E35', bg:'#D4EDDA', action: () => abrirModal('ingreso') },
    { key:'transfer', label:'Transferencia',  icon:'↔️', color:'#2E6DA4', bg:'#EEF5FC', action: () => abrirModal('transfer') },
    { key:'pago',     label:'Pago tarjeta',   icon:'💳', color:'#7A4800', bg:'#FEF3C7', action: () => abrirModal('pago') },
  ]

  return (
    <>
      {/* Speed Dial */}
      <div style={{ position:'fixed', bottom:'calc(4.5rem + env(safe-area-inset-bottom))', right:'1.25rem', zIndex:80, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'.75rem' }}>

        {/* Opciones — aparecen cuando open=true */}
        {open && ACTIONS.map((a, i) => (
          <div key={a.key} style={{
            display:'flex', alignItems:'center', gap:'.6rem',
            animation: `slideInUp .15s ease ${i * .04}s both`,
          }}>
            <span style={{ background:'rgba(0,0,0,.75)', color:'#fff', fontSize:'.78rem', fontWeight:700,
              padding:'.25rem .6rem', borderRadius:99, whiteSpace:'nowrap', backdropFilter:'blur(4px)' }}>
              {a.label}
            </span>
            <button onClick={a.action} style={{
              width:46, height:46, borderRadius:'50%', border:'none', cursor:'pointer',
              background:a.bg, color:a.color, fontSize:'1.3rem',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 14px rgba(0,0,0,.2)', flexShrink:0,
            }}>
              {a.icon}
            </button>
          </div>
        ))}

        {/* Botón principal */}
        <button onClick={() => setOpen(v => !v)} style={{
          width:56, height:56, borderRadius:'50%', border:'none', cursor:'pointer',
          background: open ? '#1F2937' : 'linear-gradient(135deg,#1E3A5F,#2E6DA4)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 6px 20px rgba(30,58,95,.45)',
          transition:'all .2s ease', transform: open ? 'rotate(45deg)' : 'none',
        }}>
          <Plus size={26} color="#fff"/>
        </button>
      </div>

      {/* Overlay oscuro cuando está abierto */}
      {open && (
        <div ref={overlayRef} onClick={() => setOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', zIndex:79, backdropFilter:'blur(2px)' }}/>
      )}

      {/* Modal Ingreso */}
      {modal === 'ingreso' && (
        <Modal titulo="💰 Nuevo ingreso" onClose={cerrarModal}>
          {done ? <Done texto="¡Ingreso registrado!"/> : (
            <form onSubmit={handleIngreso}>
              <FieldMonto moneda={formIng.moneda} monto={formIng.monto}
                onMoneda={v => setFormIng(f=>({...f,moneda:v}))}
                onMonto={v => setFormIng(f=>({...f,monto:v}))}/>
              <div className="field">
                <label className="label">Categoría</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'.4rem' }}>
                  {CATEGORIAS_INGRESO.map(c => (
                    <button key={c.label} type="button" onClick={() => setFormIng(f=>({...f,categoria:c.label}))}
                      style={{ padding:'.5rem .2rem', borderRadius:9, border:'1.5px solid', cursor:'pointer',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:'.15rem',
                        borderColor: formIng.categoria===c.label?'#1B5E35':'#E5E7EB',
                        background:  formIng.categoria===c.label?'#D4EDDA':'var(--color-card,#fff)' }}>
                      <span style={{ fontSize:'1.1rem' }}>{c.icon}</span>
                      <span style={{ fontSize:'.62rem', fontWeight:600, textAlign:'center',
                        color: formIng.categoria===c.label?'#1B5E35':'#4B5563' }}>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label className="label">Fecha</label>
                  <input className="input" type="date" value={formIng.fecha} onChange={e=>setFormIng(f=>({...f,fecha:e.target.value}))}/>
                </div>
                <div className="field">
                  <label className="label">Visibilidad</label>
                  <select className="input" value={formIng.visibilidad} onChange={e=>setFormIng(f=>({...f,visibilidad:e.target.value}))}>
                    <option value="privada">🔒 Privado</option>
                    <option value="familiar">👨‍👩‍👧 Familiar</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label">Acreditar en cuenta (opcional)</label>
                <select className="input" value={formIng.cuenta_id} onChange={e=>setFormIng(f=>({...f,cuenta_id:e.target.value}))}>
                  <option value="">No acreditar</option>
                  {cuentas.filter(c=>c.solo_consulta!=='true').map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Descripción</label>
                <input className="input" placeholder="Sueldo enero, freelance..." value={formIng.descripcion} onChange={e=>setFormIng(f=>({...f,descripcion:e.target.value}))}/>
              </div>
              {error && <ErrBox msg={error}/>}
              <BtnSubmit saving={saving} label="Registrar ingreso"/>
            </form>
          )}
        </Modal>
      )}

      {/* Modal Transferencia */}
      {modal === 'transfer' && (
        <Modal titulo="↔️ Transferencia" onClose={cerrarModal}>
          {done ? <Done texto="¡Transferencia realizada!"/> : (
            <form onSubmit={handleTransfer}>
              <div className="field">
                <label className="label">Cuenta origen</label>
                <select className="input" value={formTrans.origen_id} onChange={e=>setFormTrans(f=>({...f,origen_id:e.target.value}))} required>
                  <option value="">Seleccionar</option>
                  {cuentas.filter(c=>c.solo_consulta!=='true').map(c=>(
                    <option key={c.id} value={c.id}>{c.nombre} — {c.moneda==='USD'?'$':'RD$'} {fmtN(Number(c.balance||0))}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label">Cuenta destino</label>
                <select className="input" value={formTrans.destino_id} onChange={e=>setFormTrans(f=>({...f,destino_id:e.target.value}))} required>
                  <option value="">Seleccionar</option>
                  {cuentas.filter(c=>c.id!==formTrans.origen_id).map(c=>(
                    <option key={c.id} value={c.id}>{c.nombre} — {c.moneda==='USD'?'$':'RD$'} {fmtN(Number(c.balance||0))}</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label className="label">Monto</label>
                  <input className="input" type="number" placeholder="0.00" step="0.01" min="0.01"
                    value={formTrans.monto} onChange={e=>setFormTrans(f=>({...f,monto:e.target.value}))}
                    style={{ fontWeight:700, fontSize:'1.05rem' }} required/>
                </div>
                <div className="field">
                  <label className="label">Fecha</label>
                  <input className="input" type="date" value={formTrans.fecha} onChange={e=>setFormTrans(f=>({...f,fecha:e.target.value}))}/>
                </div>
              </div>
              <div className="field">
                <label className="label">Descripción (opcional)</label>
                <input className="input" placeholder="Ahorro mensual, pago cuota..." value={formTrans.descripcion} onChange={e=>setFormTrans(f=>({...f,descripcion:e.target.value}))}/>
              </div>
              {error && <ErrBox msg={error}/>}
              <BtnSubmit saving={saving} label="↔️ Transferir"/>
            </form>
          )}
        </Modal>
      )}

      {/* Modal Pago tarjeta */}
      {modal === 'pago' && (
        <Modal titulo="💳 Pago de tarjeta" onClose={cerrarModal}>
          {done ? <Done texto="¡Pago registrado!"/> : (
            <form onSubmit={handlePago}>
              <div className="field">
                <label className="label">Tarjeta</label>
                <select className="input" value={formPago.tarjeta_id} onChange={e=>{
                  const t = tarjetas.find(x=>x.id===e.target.value)
                  setFormPago(f=>({...f, tarjeta_id:e.target.value, moneda: t?.tipo_moneda==='USD'?'USD':'RD$' }))
                }} required>
                  <option value="">Seleccionar tarjeta</option>
                  {tarjetas.map(t=>{
                    const saldo = t.tipo_moneda==='USD'||t.tipo_moneda==='dual'
                      ? `RD$${fmtN(Number(t.saldo_usado||0))} / $${fmtN(Number(t.saldo_usado_usd||0))}`
                      : `RD$${fmtN(Number(t.saldo_usado||0))}`
                    return <option key={t.id} value={t.id}>{t.nombre} — Usado: {saldo}</option>
                  })}
                </select>
              </div>
              {formPago.tarjeta_id && (() => {
                const t = tarjetas.find(x=>x.id===formPago.tarjeta_id)
                const dual = t?.tipo_moneda==='dual'
                return dual ? (
                  <div className="field">
                    <label className="label">Moneda del pago</label>
                    <div style={{ display:'flex', gap:'.5rem' }}>
                      {['RD$','USD'].map(m=>(
                        <button key={m} type="button" onClick={()=>setFormPago(f=>({...f,moneda:m}))}
                          style={{ flex:1, padding:'.6rem', borderRadius:9, border:'1.5px solid', cursor:'pointer', fontWeight:700,
                            borderColor: formPago.moneda===m?'#2E6DA4':'#E5E7EB',
                            background:  formPago.moneda===m?'#EEF5FC':'var(--color-card,#fff)',
                            color:       formPago.moneda===m?'#2E6DA4':'#4B5563' }}>{m}</button>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
              <FieldMonto moneda={formPago.moneda} monto={formPago.monto}
                onMoneda={v=>setFormPago(f=>({...f,moneda:v}))}
                onMonto={v=>setFormPago(f=>({...f,monto:v}))}
                showMonedaToggle={false}/>
              {/* Botón pago total */}
              {formPago.tarjeta_id && (
                <button type="button" onClick={()=>{
                  const t = tarjetas.find(x=>x.id===formPago.tarjeta_id)
                  const max = formPago.moneda==='USD' ? t?.saldo_usado_usd : t?.saldo_usado
                  setFormPago(f=>({...f, monto: Number(max||0).toFixed(2) }))
                }} style={{ width:'100%', padding:'.5rem', borderRadius:8, border:'1.5px solid #2E6DA4',
                  background:'#EEF5FC', color:'#2E6DA4', fontWeight:700, fontSize:'.82rem', cursor:'pointer', marginBottom:'.75rem' }}>
                  Pagar total ({formPago.moneda==='USD'?'$':'RD$'} {fmtN(Number(tarjetas.find(t=>t.id===formPago.tarjeta_id)?.[formPago.moneda==='USD'?'saldo_usado_usd':'saldo_usado']||0))})
                </button>
              )}
              <div className="grid-2">
                <div className="field">
                  <label className="label">Débitar de cuenta</label>
                  <select className="input" value={formPago.cuenta_id} onChange={e=>setFormPago(f=>({...f,cuenta_id:e.target.value}))}>
                    <option value="">Sin débito</option>
                    {cuentas.filter(c=>c.solo_consulta!=='true').map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Fecha</label>
                  <input className="input" type="date" value={formPago.fecha} onChange={e=>setFormPago(f=>({...f,fecha:e.target.value}))}/>
                </div>
              </div>
              {error && <ErrBox msg={error}/>}
              <BtnSubmit saving={saving} label="✓ Registrar pago"/>
            </form>
          )}
        </Modal>
      )}

      <style>{`
        @keyframes slideInUp {
          from { opacity:0; transform:translateY(12px) }
          to   { opacity:1; transform:translateY(0) }
        }
      `}</style>
    </>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Modal({ titulo, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
      alignItems:'flex-end', justifyContent:'center', zIndex:1000, padding:'1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--color-card,#fff)', borderRadius:20, padding:'1.5rem',
        width:'100%', maxWidth:460, boxShadow:'0 20px 60px rgba(0,0,0,.3)',
        maxHeight:'88vh', overflowY:'auto', animation:'slideInUp .2s ease' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <p style={{ fontWeight:700, fontSize:'1.05rem' }}>{titulo}</p>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', display:'flex' }}>
            <X size={20}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FieldMonto({ moneda, monto, onMoneda, onMonto, showMonedaToggle = true }) {
  return (
    <div className="field">
      <label className="label">Monto</label>
      <div style={{ display:'flex', gap:'.5rem' }}>
        {showMonedaToggle && (
          <select className="input" style={{ width:90, flexShrink:0 }} value={moneda} onChange={e=>onMoneda(e.target.value)}>
            <option value="RD$">RD$</option>
            <option value="USD">USD</option>
          </select>
        )}
        <input className="input" type="number" placeholder="0.00" step="0.01" min="0.01"
          value={monto} onChange={e=>onMonto(e.target.value)}
          style={{ fontSize:'1.1rem', fontWeight:700 }} required/>
      </div>
    </div>
  )
}

function Done({ texto }) {
  return (
    <div style={{ textAlign:'center', padding:'1.5rem' }}>
      <CheckCircle size={48} color="#1B5E35" style={{ margin:'0 auto .75rem' }}/>
      <p style={{ fontWeight:700, color:'#1B5E35', fontSize:'1.05rem' }}>{texto}</p>
    </div>
  )
}

function ErrBox({ msg }) {
  return <div style={{ background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'.65rem .9rem', fontSize:'.875rem', marginBottom:'.75rem' }}>{msg}</div>
}

function BtnSubmit({ saving, label }) {
  return (
    <button type="submit" className="btn btn-primary btn-full" disabled={saving} style={{ padding:'.9rem', marginTop:'.25rem' }}>
      {saving ? 'Procesando...' : label}
    </button>
  )
}

const fmtN = n => Number(n).toLocaleString('es-DO', { minimumFractionDigits:2 })
