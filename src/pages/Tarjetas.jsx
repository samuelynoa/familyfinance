import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { getSheet, appendRow, getCuentas, pagarTarjeta, getPagosTarjeta, softDeleteItem } from '../services/sheets'
import { CreditCard, Plus, X, AlertCircle, ChevronDown, ChevronUp, Wallet, Clock, Trash2 } from 'lucide-react'
import ModalConfirmarEliminar from '../components/ModalConfirmarEliminar'

const COLORES = ['#1E3A5F','#B91C1C','#1B5E35','#5B21B6','#7A4800','#0E7490']
const FORM0   = { nombre:'', banco:'', moneda_rdp:true, moneda_usd:false, limite_rdp:'', limite_usd:'', fecha_corte:'25', color:COLORES[0], visibilidad:'familiar' }
const PAGO0   = { monto:'', moneda:'RD$', cuenta_id:'', fecha: new Date().toISOString().split('T')[0], descripcion:'' }

export default function Tarjetas() {
  const { perfil, isAdmin }  = useAuth()
  const { hideBalances }     = usePrefs()
  const [tarjetas,  setTarjetas]  = useState([])
  const [cuentas,   setCuentas]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [form,      setForm]      = useState(FORM0)
  // Pago
  const [pagoTarjeta, setPagoTarjeta] = useState(null) // tarjeta seleccionada para pagar
  const [pago,        setPago]        = useState(PAGO0)
  const [pagando,     setPagando]     = useState(false)
  const [pagoOk,      setPagoOk]      = useState(false)
  const [errPago,     setErrPago]     = useState('')
  // Historial
  const [historialId, setHistorialId] = useState(null)
  const [historial,   setHistorial]   = useState([])
  const [eliminando,  setEliminando]  = useState(null)
  const [gastosVinc,  setGastosVinc]  = useState(0)
  const [loadingHist, setLoadingHist] = useState(false)

  useEffect(() => { load() }, [perfil])

  async function load() {
    try {
      const [tarjData, cuentaData] = await Promise.all([
        getSheet('tarjetas_credito'),
        getCuentas({ usuarioId: perfil?.id, isAdmin }),
      ])
      setTarjetas((tarjData.rows||[]).filter(r => {
        if (r.activa !== 'true') return false
        if (r.visibilidad === 'privada') return isAdmin || r.owner_id === perfil?.id
        return true
      }))
      setCuentas(cuentaData.filter(c => c.solo_consulta !== 'true'))
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // ── Nueva tarjeta ──────────────────────────────────────────────────────────
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
      await load(); setShowForm(false); setForm(FORM0)
    } catch(e) { setError(e.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  // ── Pago de tarjeta ────────────────────────────────────────────────────────
  function abrirPago(tarjeta) {
    setPagoTarjeta(tarjeta)
    setPago({ ...PAGO0, moneda: Number(tarjeta.limite||0) > 0 ? 'RD$' : 'USD' })
    setErrPago(''); setPagoOk(false)
  }

  async function handlePago(e) {
    e.preventDefault(); setErrPago(''); setPagando(true)
    try {
      const monto = Number(pago.monto)
      if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a cero')

      const montoRDP = pago.moneda === 'RD$' ? monto : null
      const montoUSD = pago.moneda === 'USD' ? monto : null

      // Validar que no exceda el saldo usado
      const maxRDP = Number(pagoTarjeta.saldo_usado || 0)
      const maxUSD = Number(pagoTarjeta.saldo_usado_usd || 0)
      if (montoRDP && montoRDP > maxRDP) throw new Error(`El pago (RD$${fmtN(montoRDP)}) excede el saldo usado (RD$${fmtN(maxRDP)})`)
      if (montoUSD && montoUSD > maxUSD) throw new Error(`El pago ($${fmtN(montoUSD)}) excede el saldo usado ($${fmtN(maxUSD)})`)

      await pagarTarjeta({
        tarjetaId:   pagoTarjeta.id,
        cuentaId:    pago.cuenta_id || null,
        montoRDP,
        montoUSD,
        fecha:       pago.fecha,
        descripcion: pago.descripcion || `Pago ${pagoTarjeta.nombre}`,
        usuarioId:   perfil?.id,
      })

      setPagoOk(true)
      await load() // recargar saldos
      setTimeout(() => { setPagoTarjeta(null); setPagoOk(false) }, 1500)
    } catch(e) { setErrPago(e.message) }
    finally { setPagando(false) }
  }

  // ── Eliminar tarjeta ─────────────────────────────────────────────────────────
  async function abrirEliminar(tarjeta) {
    setEliminando(tarjeta)
    try {
      const gd = await getSheet('gastos')
      const count = (gd.rows || []).filter(r => r.tarjeta_id === tarjeta.id).length
      setGastosVinc(count)
    } catch { setGastosVinc(0) }
  }

  async function handleEliminar(motivo) {
    await softDeleteItem('tarjetas_credito', eliminando.id, { eliminadoPor: perfil?.id, motivo })
    setEliminando(null)
    await load()
  }

  // ── Historial ──────────────────────────────────────────────────────────────
  async function toggleHistorial(tarjetaId) {
    if (historialId === tarjetaId) { setHistorialId(null); return }
    setHistorialId(tarjetaId); setLoadingHist(true)
    try {
      const pagos = await getPagosTarjeta(tarjetaId)
      setHistorial(pagos)
    } catch(e) { setHistorial([]) }
    finally { setLoadingHist(false) }
  }

  if (loading) return <div className="spinner-center"><div className="spinner"/></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
        <h2 style={{ fontWeight:700 }}>Tarjetas de crédito</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          <Plus size={16}/> Nueva
        </button>
      </div>

      {/* Form nueva tarjeta */}
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
          <div className="field">
            <label className="label">Monedas</label>
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
                    <label htmlFor={k} style={{ fontWeight:600, fontSize:'.9rem', cursor:'pointer', color: form[k]?'#2E6DA4':'#4B5563' }}>{label}</label>
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
          <div className="field">
            <label className="label">Visibilidad</label>
            <div style={{ display:'flex', gap:'.75rem' }}>
              {[{v:'familiar',l:'👨‍👩‍👧 Familiar',d:'Todos la ven'},{v:'privada',l:'🔒 Privada',d:'Solo tú'}].map(({v,l,d}) => (
                <button key={v} type="button" onClick={() => setF('visibilidad', v)} style={{
                  flex:1, padding:'.65rem', borderRadius:10, border:'1.5px solid', cursor:'pointer', textAlign:'center',
                  borderColor: form.visibilidad===v?'#2E6DA4':'#E5E7EB',
                  background:  form.visibilidad===v?'#EEF5FC':'#fff',
                }}>
                  <p style={{ fontWeight:700, fontSize:'.85rem', color: form.visibilidad===v?'#2E6DA4':'#1F2937' }}>{l}</p>
                  <p style={{ fontSize:'.7rem', color:'#9CA3AF', marginTop:'.1rem' }}>{d}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="label">Color</label>
            <div style={{ display:'flex', gap:'.6rem', flexWrap:'wrap' }}>
              {COLORES.map(c => (
                <button key={c} type="button" onClick={() => setF('color', c)}
                  style={{ width:32, height:32, borderRadius:'50%', background:c, cursor:'pointer',
                    border: form.color===c?'3px solid #1F2937':'2px solid #E5E7EB' }}/>
              ))}
            </div>
          </div>
          {error && <div style={S.err}>{error}</div>}
          <div style={{ display:'flex', gap:'.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Guardando...':'Guardar tarjeta'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Lista tarjetas */}
      {tarjetas.length === 0 && !showForm ? (
        <div style={S.empty}>
          <CreditCard size={40} color="#9CA3AF"/>
          <p style={{ fontWeight:600 }}>No hay tarjetas registradas</p>
          <p style={{ fontSize:'.875rem', color:'#9CA3AF' }}>Agrega tu primera tarjeta de crédito</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          {tarjetas.map(t => (
            <TarjetaCard key={t.id} tarjeta={t} hideBalances={hideBalances}
              onPagar={() => abrirPago(t)}
              onHistorial={() => toggleHistorial(t.id)}
              onDelete={() => abrirEliminar(t)}
              puedeEliminar={isAdmin || (t.visibilidad === 'privada' && t.owner_id === perfil?.id)}
              historialOpen={historialId === t.id}
              historial={historialId === t.id ? historial : []}
              loadingHist={historialId === t.id && loadingHist}
            />
          ))}
        </div>
      )}

      {eliminando && (
        <ModalConfirmarEliminar
          item={eliminando}
          tipo="tarjeta"
          onConfirm={handleEliminar}
          onCancel={() => setEliminando(null)}
          advertencia={gastosVinc > 0 ? `Esta tarjeta tiene ${gastosVinc} gasto(s) vinculado(s). Se desasignarán pero no se eliminarán.` : null}
        />
      )}

      {/* Modal pago de tarjeta */}
      {pagoTarjeta && (
        <div style={S.overlay} onClick={() => !pagando && setPagoTarjeta(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
              <div>
                <p style={{ fontWeight:700, fontSize:'1rem' }}>💳 Pagar tarjeta</p>
                <p style={{ fontSize:'.82rem', color:'#6B7280' }}>{pagoTarjeta.nombre}</p>
              </div>
              <button onClick={() => setPagoTarjeta(null)} style={S.close}><X size={20}/></button>
            </div>

            {/* Saldo actual */}
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:'.75rem 1rem', marginBottom:'1rem' }}>
              <p style={{ fontSize:'.75rem', color:'#9CA3AF', marginBottom:'.3rem' }}>Saldo usado actualmente</p>
              <div style={{ display:'flex', gap:'1.5rem' }}>
                {Number(pagoTarjeta.limite||0) > 0 && (
                  <div>
                    <p style={{ fontWeight:700, color:'#DC2626' }}>RD$ {fmtN(Number(pagoTarjeta.saldo_usado||0))}</p>
                    <p style={{ fontSize:'.72rem', color:'#9CA3AF' }}>de RD$ {fmtN(Number(pagoTarjeta.limite||0))}</p>
                  </div>
                )}
                {Number(pagoTarjeta.limite_usd||0) > 0 && (
                  <div>
                    <p style={{ fontWeight:700, color:'#DC2626' }}>$ {fmtN(Number(pagoTarjeta.saldo_usado_usd||0))}</p>
                    <p style={{ fontSize:'.72rem', color:'#9CA3AF' }}>de $ {fmtN(Number(pagoTarjeta.limite_usd||0))}</p>
                  </div>
                )}
              </div>
            </div>

            {pagoOk ? (
              <div style={{ textAlign:'center', padding:'1.5rem' }}>
                <p style={{ fontSize:'2rem', marginBottom:'.5rem' }}>✅</p>
                <p style={{ fontWeight:700, color:'#1B5E35' }}>¡Pago registrado!</p>
                <p style={{ fontSize:'.85rem', color:'#6B7280' }}>El saldo se actualizó correctamente</p>
              </div>
            ) : (
              <form onSubmit={handlePago}>
                {/* Moneda */}
                <div className="field">
                  <label className="label">Moneda del pago</label>
                  <div style={{ display:'flex', gap:'.5rem' }}>
                    {Number(pagoTarjeta.limite||0) > 0 && (
                      <button type="button" onClick={() => setPago(p=>({...p, moneda:'RD$'}))}
                        style={{ ...S.monedaBtn, borderColor: pago.moneda==='RD$'?'#2E6DA4':'#E5E7EB', background: pago.moneda==='RD$'?'#EEF5FC':'#fff', color: pago.moneda==='RD$'?'#2E6DA4':'#4B5563' }}>
                        RD$
                      </button>
                    )}
                    {Number(pagoTarjeta.limite_usd||0) > 0 && (
                      <button type="button" onClick={() => setPago(p=>({...p, moneda:'USD'}))}
                        style={{ ...S.monedaBtn, borderColor: pago.moneda==='USD'?'#2E6DA4':'#E5E7EB', background: pago.moneda==='USD'?'#EEF5FC':'#fff', color: pago.moneda==='USD'?'#2E6DA4':'#4B5563' }}>
                        USD
                      </button>
                    )}
                  </div>
                </div>

                {/* Monto */}
                <div className="field">
                  <label className="label">Monto a pagar</label>
                  <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
                    <input className="input" type="number" placeholder="0.00" step="0.01" min="0.01"
                      value={pago.monto} onChange={e => setPago(p=>({...p, monto:e.target.value}))}
                      style={{ fontSize:'1.1rem', fontWeight:700 }} required/>
                    {/* Botón pago total */}
                    <button type="button" onClick={() => {
                      const max = pago.moneda==='RD$' ? pagoTarjeta.saldo_usado : pagoTarjeta.saldo_usado_usd
                      setPago(p=>({...p, monto: Number(max||0).toFixed(2)}))
                    }} style={{ flexShrink:0, padding:'.55rem .75rem', borderRadius:8, border:'1.5px solid #2E6DA4',
                      background:'#EEF5FC', color:'#2E6DA4', fontWeight:700, fontSize:'.78rem', cursor:'pointer', whiteSpace:'nowrap' }}>
                      Pago total
                    </button>
                  </div>
                </div>

                {/* Cuenta origen */}
                <div className="field">
                  <label className="label">Débitar de cuenta <span style={{ color:'#9CA3AF', fontWeight:400 }}>(opcional)</span></label>
                  <select className="input" value={pago.cuenta_id} onChange={e => setPago(p=>({...p, cuenta_id:e.target.value}))}>
                    <option value="">Sin débito automático</option>
                    {cuentas.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} — {c.moneda} {fmtN(Number(c.balance||0))}</option>
                    ))}
                  </select>
                </div>

                <div className="grid-2">
                  <div className="field">
                    <label className="label">Fecha</label>
                    <input className="input" type="date" value={pago.fecha}
                      onChange={e => setPago(p=>({...p, fecha:e.target.value}))}/>
                  </div>
                  <div className="field">
                    <label className="label">Descripción</label>
                    <input className="input" placeholder="Opcional" value={pago.descripcion}
                      onChange={e => setPago(p=>({...p, descripcion:e.target.value}))}/>
                  </div>
                </div>

                {errPago && <div style={S.err}>{errPago}</div>}

                <div style={{ display:'flex', gap:'.75rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={pagando} style={{ flex:1, padding:'.85rem' }}>
                    {pagando ? 'Procesando...' : '✓ Registrar pago'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setPagoTarjeta(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TarjetaCard ────────────────────────────────────────────────────────────────
function TarjetaCard({ tarjeta, hideBalances, onPagar, onHistorial, onDelete, puedeEliminar, historialOpen, historial, loadingHist }) {
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

      {/* Barras + acciones */}
      <div style={{ background:'var(--color-card,#fff)', padding:'1rem' }}>
        {tieneRDP && <Barra usado={Number(tarjeta.saldo_usado||0)} limite={Number(tarjeta.limite||0)} label="RD$"/>}
        {tieneUSD && <Barra usado={Number(tarjeta.saldo_usado_usd||0)} limite={Number(tarjeta.limite_usd||0)} label="USD" mt={tieneRDP}/>}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'.75rem' }}>
          <p style={{ fontSize:'.75rem', color:'#9CA3AF' }}>Corte día {tarjeta.fecha_corte}</p>
          {tarjeta.visibilidad === 'privada' && <span style={{ fontSize:'.7rem', color:'#9CA3AF' }}>🔒 Privada</span>}
        </div>

        {/* Botones de acción */}
        <div style={{ display:'flex', gap:'.6rem', marginTop:'.85rem' }}>
          <button onClick={onPagar} style={S.actionBtn}>
            <Wallet size={15}/> Registrar pago
          </button>
          <button onClick={onHistorial} style={{ ...S.actionBtn, background:'var(--color-card-hover,#F3F4F6)', color:'var(--color-text-secondary,#4B5563)' }}>
            <Clock size={15}/> Historial
            {historialOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          {puedeEliminar && (
            <button onClick={onDelete} style={{ ...S.actionBtn, background:'#FEE2E2', color:'#DC2626', flex:'0 0 auto', padding:'.55rem .6rem' }}>
              <Trash2 size={15}/>
            </button>
          )}
        </div>
      </div>

      {/* Historial de pagos */}
      {historialOpen && (
        <div style={{ borderTop:'1px solid var(--color-border-secondary,#F3F4F6)', background:'var(--color-card,#fff)' }}>
          <p style={{ fontSize:'.72rem', fontWeight:700, color:'#9CA3AF', padding:'.6rem 1rem .3rem', textTransform:'uppercase', letterSpacing:'.05em' }}>
            Historial de pagos
          </p>
          {loadingHist ? (
            <div style={{ padding:'1rem', textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }}/></div>
          ) : historial.length === 0 ? (
            <p style={{ padding:'1rem', color:'#9CA3AF', fontSize:'.875rem', textAlign:'center' }}>Sin pagos registrados</p>
          ) : (
            historial.map((p, i) => (
              <div key={p.id||i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'.65rem 1rem', borderTop: i > 0 ? '1px solid var(--color-border-secondary,#F9FAFB)' : 'none' }}>
                <div>
                  <p style={{ fontWeight:600, fontSize:'.875rem' }}>{p.descripcion || 'Pago de tarjeta'}</p>
                  <p style={{ fontSize:'.72rem', color:'#9CA3AF' }}>{p.fecha}</p>
                </div>
                <p style={{ fontWeight:700, color:'#1B5E35', fontSize:'.875rem' }}>
                  {p.monto_rdp ? `+RD$${fmtN(Number(p.monto_rdp))}` : `+$${fmtN(Number(p.monto_usd))}`}
                </p>
              </div>
            ))
          )}
        </div>
      )}
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
  close:     { background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', display:'flex' },
  err:       { background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'.65rem .9rem', fontSize:'.875rem', marginBottom:'.75rem' },
  empty:     { display:'flex', flexDirection:'column', alignItems:'center', gap:'.75rem', padding:'3rem 1rem', textAlign:'center' },
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:1000, padding:'1rem' },
  modal:     { background:'var(--color-card,#fff)', borderRadius:20, padding:'1.5rem', width:'100%', maxWidth:460, boxShadow:'0 20px 60px rgba(0,0,0,.3)', maxHeight:'90vh', overflowY:'auto' },
  actionBtn: { display:'flex', alignItems:'center', gap:'.4rem', padding:'.55rem .85rem', borderRadius:9, border:'none', cursor:'pointer', fontWeight:700, fontSize:'.8rem', background:'#EEF5FC', color:'#2E6DA4' },
  monedaBtn: { flex:1, padding:'.6rem', borderRadius:9, border:'1.5px solid', cursor:'pointer', fontWeight:700, fontSize:'.9rem' },
}
