import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getSheet, appendRow, updateRow, getCuentas, getUsuarios,
} from '../services/sheets'
import { Plus, X, Pencil, Repeat, Clock, Zap, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

const CATEGORIAS = [
  { label:'Supermercado',icon:'🛒' },{ label:'Combustible',icon:'⛽' },
  { label:'Educación',icon:'📚' },{ label:'Salud',icon:'🏥' },
  { label:'Entretenimiento',icon:'🎬' },{ label:'Servicios (agua/luz/internet)',icon:'💡' },
  { label:'Comidas Fuera de Casa',icon:'🍽️' },{ label:'Suscripciones',icon:'📱' },
  { label:'Mesada Familiar',icon:'👨‍👩‍👧' },{ label:'Préstamos',icon:'🏦' },
  { label:'Ahorros',icon:'💰' },{ label:'Salidas',icon:'🎉' },
  { label:'Ropa',icon:'👗' },{ label:'Hogar',icon:'🏠' },
  { label:'Vacaciones',icon:'✈️' },{ label:'Mantenimiento Vehículo',icon:'🚗' },
]

const FRECUENCIAS = [
  { value:'semanal',    label:'Semanal',    dias:7   },
  { value:'quincenal',  label:'Quincenal',  dias:15  },
  { value:'mensual',    label:'Mensual',    dias:30  },
  { value:'anual',      label:'Anual',      dias:365 },
]

const TIPOS = [
  { value:'gasto',        label:'💸 Gasto',        icon:'💸' },
  { value:'transferencia',label:'↔️ Transferencia', icon:'↔️' },
]

const FORM0 = {
  nombre:'', tipo:'gasto', categoria:'', monto:'', moneda:'RD$',
  cuenta_id:'', tarjeta_id:'', cuenta_destino_id:'',
  frecuencia:'mensual', dia_del_mes:'1',
  fecha_inicio: new Date().toISOString().split('T')[0],
  fecha_fin:'', personal_familiar:'familiar',
  confirmacion:'manual', // 'manual' | 'auto'
  activo:'true',
}

export default function GastosRecurrentes() {
  const { perfil, isAdmin } = useAuth()
  const [recurrentes, setRecurrentes] = useState([])
  const [cuentas,     setCuentas]     = useState([])
  const [tarjetas,    setTarjetas]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editando,    setEditando]    = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [form,        setForm]        = useState(FORM0)
  const [expandId,    setExpandId]    = useState(null)

  useEffect(() => { load() }, [perfil])

  async function load() {
    if (!perfil) return
    try {
      const [recData, cuentaData, tarjData] = await Promise.all([
        getSheet('gastos_recurrentes'),
        getCuentas({ usuarioId: perfil.id, isAdmin }),
        getSheet('tarjetas_credito'),
      ])
      setRecurrentes((recData.rows || []).filter(r =>
        isAdmin || r.usuario_id === perfil.id
      ))
      setCuentas(cuentaData)
      setTarjetas((tarjData.rows || []).filter(r => r.activa === 'true'))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function abrirNuevo() {
    setEditando(null)
    setForm(FORM0)
    setError('')
    setShowForm(true)
  }

  function abrirEditar(r) {
    setEditando(r)
    setForm({
      nombre:            r.nombre,
      tipo:              r.tipo || 'gasto',
      categoria:         r.categoria || '',
      monto:             r.monto,
      moneda:            r.moneda || 'RD$',
      cuenta_id:         r.cuenta_id || '',
      tarjeta_id:        r.tarjeta_id || '',
      cuenta_destino_id: r.cuenta_destino_id || '',
      frecuencia:        r.frecuencia || 'mensual',
      dia_del_mes:       r.dia_del_mes || '1',
      fecha_inicio:      r.fecha_inicio || '',
      fecha_fin:         r.fecha_fin || '',
      personal_familiar: r.personal_familiar || 'familiar',
      confirmacion:      r.confirmacion || 'manual',
      activo:            r.activo || 'true',
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      if (!form.nombre) throw new Error('El nombre es obligatorio')
      if (!form.monto || Number(form.monto) <= 0) throw new Error('El monto debe ser mayor a cero')
      if (form.tipo === 'gasto' && !form.categoria) throw new Error('Selecciona una categoría')
      if (form.tipo === 'transferencia' && !form.cuenta_destino_id) throw new Error('Selecciona la cuenta destino')

      const row = {
        nombre:            form.nombre,
        tipo:              form.tipo,
        categoria:         form.categoria,
        monto:             Number(form.monto).toFixed(2),
        moneda:            form.moneda,
        cuenta_id:         form.cuenta_id || '',
        tarjeta_id:        form.tipo === 'gasto' ? (form.tarjeta_id || '') : '',
        cuenta_destino_id: form.tipo === 'transferencia' ? (form.cuenta_destino_id || '') : '',
        frecuencia:        form.frecuencia,
        dia_del_mes:       form.dia_del_mes,
        fecha_inicio:      form.fecha_inicio,
        fecha_fin:         form.fecha_fin || '',
        personal_familiar: form.personal_familiar,
        confirmacion:      form.confirmacion,
        activo:            'true',
        usuario_id:        perfil?.id || '',
      }

      if (editando) {
        const data = await getSheet('gastos_recurrentes')
        const idx  = (data.rows || []).findIndex(r => r.id === editando.id)
        if (idx !== -1) {
          await updateRow('gastos_recurrentes', idx + 2, { ...editando, ...row })
        }
      } else {
        await appendRow('gastos_recurrentes', { id: `rec_${Date.now()}`, ...row })
      }

      await load(); setShowForm(false); setEditando(null); setForm(FORM0)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function toggleActivo(rec) {
    const data = await getSheet('gastos_recurrentes')
    const idx  = (data.rows || []).findIndex(r => r.id === rec.id)
    if (idx !== -1) {
      await updateRow('gastos_recurrentes', idx + 2, { ...rec, activo: rec.activo === 'true' ? 'false' : 'true' })
      await load()
    }
  }

  const activos   = recurrentes.filter(r => r.activo === 'true')
  const inactivos = recurrentes.filter(r => r.activo !== 'true')

  if (loading) return <div className="spinner-center"><div className="spinner"/></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
        <h2 style={{ fontWeight:700 }}>Recurrentes</h2>
        <button className="btn btn-primary" onClick={abrirNuevo}><Plus size={16}/> Nuevo</button>
      </div>

      {showForm && (
        <form className="card" style={{ marginBottom:'1rem' }} onSubmit={handleSubmit}>
          <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
            <h3 style={{ fontWeight:600 }}>{editando ? '✏️ Editar recurrente' : '🔄 Nuevo recurrente'}</h3>
            <button type="button" onClick={() => { setShowForm(false); setEditando(null) }} style={S.closeBtn}><X size={18}/></button>
          </div>

          {/* Tipo */}
          <div className="field">
            <label className="label">Tipo</label>
            <div style={{ display:'flex', gap:'.5rem' }}>
              {TIPOS.map(t => (
                <button key={t.value} type="button" onClick={() => setF('tipo', t.value)}
                  style={{ flex:1, padding:'.6rem', borderRadius:10, border:'1.5px solid', cursor:'pointer',
                    fontWeight:600, fontSize:'.85rem', textAlign:'center',
                    borderColor: form.tipo===t.value?'#2E6DA4':'#E5E7EB',
                    background:  form.tipo===t.value?'#EEF5FC':'var(--color-card,#fff)',
                    color:       form.tipo===t.value?'#2E6DA4':'#4B5563' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div className="field">
            <label className="label">Nombre</label>
            <input className="input" placeholder="Ej: Factura Claro, Sueldo empleada..."
              value={form.nombre} onChange={e => setF('nombre', e.target.value)} required/>
          </div>

          {/* Categoría — solo para gastos */}
          {form.tipo === 'gasto' && (
            <div className="field">
              <label className="label">Categoría</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'.4rem' }}>
                {CATEGORIAS.map(c => (
                  <button key={c.label} type="button" onClick={() => setF('categoria', c.label)}
                    style={{ padding:'.4rem .2rem', borderRadius:9, border:'1.5px solid', cursor:'pointer',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:'.15rem',
                      borderColor: form.categoria===c.label?'#1B5E35':'#E5E7EB',
                      background:  form.categoria===c.label?'#D4EDDA':'var(--color-card,#fff)' }}>
                    <span style={{ fontSize:'1.1rem' }}>{c.icon}</span>
                    <span style={{ fontSize:'.6rem', fontWeight:600, color:form.categoria===c.label?'#1B5E35':'#4B5563', textAlign:'center', lineHeight:1.2 }}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monto */}
          <div className="field">
            <label className="label">Monto</label>
            <div style={{ display:'flex', gap:'.5rem' }}>
              <select className="input" style={{ width:90, flexShrink:0 }} value={form.moneda} onChange={e => setF('moneda', e.target.value)}>
                <option value="RD$">RD$</option>
                <option value="USD">USD</option>
              </select>
              <input className="input" type="number" placeholder="0.00" step="0.01" min="0.01"
                value={form.monto} onChange={e => setF('monto', e.target.value)}
                style={{ fontSize:'1.05rem', fontWeight:700 }} required/>
            </div>
          </div>

          {/* Cuenta / Tarjeta */}
          {form.tipo === 'gasto' && (
            <div className="grid-2">
              <div className="field">
                <label className="label">Cuenta de débito</label>
                <select className="input" value={form.cuenta_id} onChange={e => { setF('cuenta_id', e.target.value); setF('tarjeta_id', '') }}>
                  <option value="">Sin cuenta</option>
                  {cuentas.filter(c => c.solo_consulta !== 'true').map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">O tarjeta</label>
                <select className="input" value={form.tarjeta_id} onChange={e => { setF('tarjeta_id', e.target.value); setF('cuenta_id', '') }}>
                  <option value="">Sin tarjeta</option>
                  {tarjetas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            </div>
          )}

          {form.tipo === 'transferencia' && (
            <div className="grid-2">
              <div className="field">
                <label className="label">Cuenta origen</label>
                <select className="input" value={form.cuenta_id} onChange={e => setF('cuenta_id', e.target.value)} required>
                  <option value="">Seleccionar</option>
                  {cuentas.filter(c => c.solo_consulta !== 'true').map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Cuenta destino</label>
                <select className="input" value={form.cuenta_destino_id} onChange={e => setF('cuenta_destino_id', e.target.value)} required>
                  <option value="">Seleccionar</option>
                  {cuentas.filter(c => c.id !== form.cuenta_id).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Frecuencia y día */}
          <div className="grid-2">
            <div className="field">
              <label className="label">Frecuencia</label>
              <select className="input" value={form.frecuencia} onChange={e => setF('frecuencia', e.target.value)}>
                {FRECUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">{form.frecuencia === 'semanal' ? 'Día semana (1=Lun)' : form.frecuencia === 'anual' ? 'Día del año' : 'Día del mes'}</label>
              <input className="input" type="number" min="1" max={form.frecuencia === 'semanal' ? 7 : form.frecuencia === 'anual' ? 365 : 31}
                value={form.dia_del_mes} onChange={e => setF('dia_del_mes', e.target.value)}/>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid-2">
            <div className="field">
              <label className="label">Fecha inicio</label>
              <input className="input" type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)}/>
            </div>
            <div className="field">
              <label className="label">Fecha fin (opcional)</label>
              <input className="input" type="date" value={form.fecha_fin} onChange={e => setF('fecha_fin', e.target.value)}/>
            </div>
          </div>

          {/* Personal/Familiar — solo gastos */}
          {form.tipo === 'gasto' && (
            <div className="field">
              <label className="label">Tipo de gasto</label>
              <div style={{ display:'flex', gap:'.5rem' }}>
                {[{v:'familiar',l:'👨‍👩‍👧 Familiar'},{v:'personal',l:'👤 Personal'}].map(({v,l}) => (
                  <button key={v} type="button" onClick={() => setF('personal_familiar', v)}
                    style={{ flex:1, padding:'.55rem', borderRadius:9, border:'1.5px solid', cursor:'pointer', fontWeight:600, fontSize:'.82rem', textAlign:'center',
                      borderColor: form.personal_familiar===v?'#2E6DA4':'#E5E7EB',
                      background:  form.personal_familiar===v?'#EEF5FC':'var(--color-card,#fff)',
                      color:       form.personal_familiar===v?'#2E6DA4':'#4B5563' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Modo confirmación */}
          <div className="field">
            <label className="label">¿Cómo confirmar?</label>
            <div style={{ display:'flex', gap:'.5rem' }}>
              {[
                { v:'manual', l:'🔔 Recordatorio', d:'Confirmo yo cada vez' },
                { v:'auto',   l:'⚡ Automático',   d:'Se registra solo' },
              ].map(({v,l,d}) => (
                <button key={v} type="button" onClick={() => setF('confirmacion', v)}
                  style={{ flex:1, padding:'.6rem', borderRadius:10, border:'1.5px solid', cursor:'pointer', textAlign:'center',
                    borderColor: form.confirmacion===v?'#2E6DA4':'#E5E7EB',
                    background:  form.confirmacion===v?'#EEF5FC':'var(--color-card,#fff)' }}>
                  <p style={{ fontWeight:700, fontSize:'.82rem', color:form.confirmacion===v?'#2E6DA4':'#1F2937' }}>{l}</p>
                  <p style={{ fontSize:'.68rem', color:'#9CA3AF', marginTop:'.1rem' }}>{d}</p>
                </button>
              ))}
            </div>
          </div>

          {error && <div style={S.errorBox}>{error}</div>}

          <div style={{ display:'flex', gap:'.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear recurrente'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditando(null) }}>Cancelar</button>
          </div>
        </form>
      )}

      {recurrentes.length === 0 && !showForm ? (
        <div style={S.empty}>
          <Repeat size={40} color="#9CA3AF"/>
          <p style={{ fontWeight:600 }}>No hay gastos recurrentes</p>
          <p style={{ fontSize:'.875rem', color:'#9CA3AF' }}>Crea recordatorios para gastos fijos mensuales</p>
        </div>
      ) : (
        <>
          {activos.length > 0 && (
            <div style={{ marginBottom:'1.5rem' }}>
              <p style={S.secLabel}>✅ Activos ({activos.length})</p>
              {activos.map(r => (
                <RecurrenteCard key={r.id} r={r} cuentas={cuentas} tarjetas={tarjetas}
                  expanded={expandId===r.id} onToggle={() => setExpandId(expandId===r.id?null:r.id)}
                  onEdit={() => abrirEditar(r)} onToggleActivo={() => toggleActivo(r)}/>
              ))}
            </div>
          )}
          {inactivos.length > 0 && (
            <div>
              <p style={S.secLabel}>⏸️ Inactivos ({inactivos.length})</p>
              {inactivos.map(r => (
                <RecurrenteCard key={r.id} r={r} cuentas={cuentas} tarjetas={tarjetas}
                  expanded={expandId===r.id} onToggle={() => setExpandId(expandId===r.id?null:r.id)}
                  onEdit={() => abrirEditar(r)} onToggleActivo={() => toggleActivo(r)}/>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RecurrenteCard({ r, cuentas, tarjetas, expanded, onToggle, onEdit, onToggleActivo }) {
  const cuenta  = cuentas.find(c => c.id === r.cuenta_id)
  const tarjeta = tarjetas.find(t => t.id === r.tarjeta_id)
  const cuentaDest = cuentas.find(c => c.id === r.cuenta_destino_id)
  const freq    = FRECUENCIAS.find(f => f.value === r.frecuencia)
  const esActivo = r.activo === 'true'
  const esAuto   = r.confirmacion === 'auto'

  return (
    <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:'.75rem', opacity: esActivo?1:.6 }}>
      <div style={{ display:'flex', alignItems:'center', padding:'1rem', gap:'.85rem' }}>
        <div style={{ width:44, height:44, borderRadius:12, flexShrink:0,
          background: esActivo?'#EEF5FC':'#F3F4F6',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem' }}>
          {r.tipo==='transferencia'?'↔️':(CATEGORIAS.find(c=>c.label===r.categoria)?.icon||'💸')}
        </div>

        <div style={{ flex:1, cursor:'pointer' }} onClick={onToggle}>
          <div style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
            <p style={{ fontWeight:600, fontSize:'.95rem' }}>{r.nombre}</p>
            {esAuto && <span style={{ fontSize:'.62rem', background:'#FEF3C7', color:'#92400E', padding:'.1rem .35rem', borderRadius:99, fontWeight:700 }}>⚡AUTO</span>}
          </div>
          <p style={{ fontSize:'.75rem', color:'#9CA3AF' }}>
            {freq?.label} · día {r.dia_del_mes} · {r.moneda} {fmtN(Number(r.monto))}
          </p>
        </div>

        <div style={{ textAlign:'right', flexShrink:0 }}>
          <p style={{ fontWeight:800, fontSize:'.95rem', color: r.tipo==='transferencia'?'#2E6DA4':'#DC2626' }}>
            {r.moneda === 'USD' ? '$' : 'RD$'} {fmtN(Number(r.monto))}
          </p>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'.3rem', flexShrink:0 }}>
          <button onClick={onEdit} style={{ ...S.iconBtn, color:'#2E6DA4' }}><Pencil size={14}/></button>
          <button onClick={onToggleActivo} style={{ ...S.iconBtn, color: esActivo?'#D97706':'#1B5E35' }}>
            {esActivo ? <Clock size={14}/> : <Repeat size={14}/>}
          </button>
          <button onClick={onToggle} style={{ ...S.iconBtn, color:'#9CA3AF' }}>
            {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop:'1px solid var(--color-border-secondary,#F3F4F6)', padding:'.75rem 1rem', background:'var(--color-card-hover,#F9FAFB)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.5rem', fontSize:'.82rem' }}>
            <Info label="Categoría" value={r.categoria || r.tipo} />
            <Info label="Frecuencia" value={freq?.label || r.frecuencia} />
            {cuenta    && <Info label={r.tipo==='transferencia'?'Origen':'Cuenta'} value={cuenta.nombre} />}
            {tarjeta   && <Info label="Tarjeta" value={tarjeta.nombre} />}
            {cuentaDest && <Info label="Destino" value={cuentaDest.nombre} />}
            <Info label="Día" value={`Día ${r.dia_del_mes}`} />
            <Info label="Confirmación" value={esAuto ? '⚡ Automático' : '🔔 Manual'} />
            {r.personal_familiar && <Info label="Tipo" value={r.personal_familiar === 'familiar' ? '👨‍👩‍👧 Familiar' : '👤 Personal'} />}
            {r.fecha_inicio && <Info label="Desde" value={r.fecha_inicio} />}
            {r.fecha_fin    && <Info label="Hasta" value={r.fecha_fin} />}
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <p style={{ fontSize:'.7rem', color:'#9CA3AF', marginBottom:'.1rem' }}>{label}</p>
      <p style={{ fontWeight:600 }}>{value}</p>
    </div>
  )
}

const fmtN = n => Number(n).toLocaleString('es-DO', { minimumFractionDigits:2 })
const S = {
  closeBtn: { background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', display:'flex' },
  iconBtn:  { background:'none', border:'none', cursor:'pointer', display:'flex', padding:'.2rem' },
  errorBox: { background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'.65rem .9rem', fontSize:'.875rem', marginBottom:'.75rem' },
  empty:    { display:'flex', flexDirection:'column', alignItems:'center', gap:'.75rem', padding:'3rem 1rem', textAlign:'center' },
  secLabel: { fontSize:'.75rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'.5rem' },
}
