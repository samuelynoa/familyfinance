import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSheet, appendRow, updateRow, getGastos, softDeleteItem } from '../services/sheets'
import { Plus, X, Bell, BellOff, AlertCircle, CheckCircle, Trash2, Pencil, Star, StarOff, ChevronDown, ChevronUp } from 'lucide-react'
import ModalConfirmarEliminar from '../components/ModalConfirmarEliminar'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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

const FORM_VACIO = {
  nombre: '', tipo: 'especifico', categorias: [], categoria: '',
  monto_mensual_rdp: '', alerta_80: 'true', alerta_100: 'true',
  visibilidad: 'familiar', descuento: 'auto', predeterminado: false,
}

export default function Presupuestos() {
  const { isAdmin, perfil } = useAuth()
  const [presupuestos,  setPresupuestos]  = useState([])
  const [gastosDelMes,  setGastosDelMes]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [editando,      setEditando]      = useState(null)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [eliminando,    setEliminando]    = useState(null)
  const [expandId,      setExpandId]      = useState(null)
  const [form,          setForm]          = useState(FORM_VACIO)

  const mes      = format(new Date(), 'yyyy-MM')
  const mesLabel = format(new Date(), 'MMMM yyyy', { locale: es })

  useEffect(() => { load() }, [perfil])

  async function load() {
    if (!perfil) return
    try {
      const [presData, gastosData] = await Promise.all([
        getSheet('presupuestos'),
        getGastos({ mes }),
      ])
      const todos = (presData.rows || []).filter(r => {
        if (r.activo === 'false' || r.eliminado === 'true') return false
        const vis = r.visibilidad || 'familiar'
        if (vis === 'privada') return isAdmin || r.owner_id === perfil?.id
        return true
      }).map(r => ({
        ...r,
        // Normalizar categorias — puede ser string JSON o string separado por comas
        _categorias: parseCategorias(r.categorias || r.categoria || ''),
      }))
      setPresupuestos(todos)
      setGastosDelMes(gastosData)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function parseCategorias(val) {
    if (!val) return []
    try { return JSON.parse(val) } catch {
      return val.split(',').map(v => v.trim()).filter(Boolean)
    }
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleCategoria(cat) {
    setForm(f => {
      const cats = f.categorias.includes(cat)
        ? f.categorias.filter(c => c !== cat)
        : [...f.categorias, cat]
      return { ...f, categorias: cats }
    })
  }

  function abrirNuevo() {
    setEditando(null); setForm(FORM_VACIO); setError(''); setShowForm(true)
  }

  function abrirEditar(p) {
    setEditando(p)
    setForm({
      nombre:            p.nombre || '',
      tipo:              p.tipo || 'especifico',
      categorias:        p._categorias || [],
      categoria:         p.categoria || '',
      monto_mensual_rdp: p.monto_mensual_rdp || '',
      alerta_80:         p.alerta_80 || 'true',
      alerta_100:        p.alerta_100 || 'true',
      visibilidad:       p.visibilidad || 'familiar',
      descuento:         p.descuento || 'auto',
      predeterminado:    p.predeterminado === 'true',
    })
    setError(''); setShowForm(true); setExpandId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      if (!form.nombre.trim()) throw new Error('El nombre es obligatorio')
      if (!form.monto_mensual_rdp || Number(form.monto_mensual_rdp) <= 0) throw new Error('El monto debe ser mayor a cero')

      const esGeneral = form.tipo === 'general'
      if (esGeneral && form.categorias.length === 0) throw new Error('Selecciona al menos una categoría')
      if (!esGeneral && !form.categoria) throw new Error('Selecciona la categoría')

      // Si se marca como predeterminado, quitar predeterminado de otros generales
      if (form.predeterminado && esGeneral) {
        const data = await getSheet('presupuestos')
        for (let i = 0; i < (data.rows || []).length; i++) {
          const r = data.rows[i]
          if (r.predeterminado === 'true' && r.tipo === 'general' && r.id !== editando?.id) {
            await updateRow('presupuestos', i + 2, { ...r, predeterminado: 'false' })
          }
        }
      }

      const row = {
        nombre:            form.nombre.trim(),
        tipo:              form.tipo,
        categoria:         esGeneral ? '' : form.categoria,
        categorias:        esGeneral ? JSON.stringify(form.categorias) : JSON.stringify([form.categoria]),
        monto_mensual_rdp: Number(form.monto_mensual_rdp).toFixed(2),
        alerta_80:         form.alerta_80,
        alerta_100:        form.alerta_100,
        activo:            'true',
        visibilidad:       form.visibilidad || 'familiar',
        owner_id:          form.visibilidad === 'privada' ? (perfil?.id || '') : '',
        descuento:         form.descuento || 'auto',
        predeterminado:    esGeneral ? String(form.predeterminado) : 'false',
      }

      if (editando) {
        const data = await getSheet('presupuestos')
        const idx  = (data.rows || []).findIndex(r => r.id === editando.id)
        if (idx !== -1) await updateRow('presupuestos', idx + 2, { ...editando, ...row })
      } else {
        await appendRow('presupuestos', { id: 'pres_' + Date.now(), ...row })
      }

      await load(); setShowForm(false); setEditando(null); setForm(FORM_VACIO)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleEliminar(motivo) {
    await softDeleteItem('presupuestos', eliminando.id, { eliminadoPor: perfil?.id, motivo })
    setEliminando(null)
    await load()
  }

  async function togglePredeterminado(p) {
    const esActual = p.predeterminado === 'true'
    if (!esActual) {
      // Quitar predeterminado de otros
      const data = await getSheet('presupuestos')
      for (let i = 0; i < (data.rows || []).length; i++) {
        const r = data.rows[i]
        if (r.predeterminado === 'true' && r.id !== p.id) {
          await updateRow('presupuestos', i + 2, { ...r, predeterminado: 'false' })
        }
      }
    }
    const data2 = await getSheet('presupuestos')
    const idx   = (data2.rows || []).findIndex(r => r.id === p.id)
    if (idx !== -1) await updateRow('presupuestos', idx + 2, { ...data2.rows[idx], predeterminado: esActual ? 'false' : 'true' })
    await load()
  }

  // Calcular gasto acumulado para un presupuesto
  function gastoPresupuesto(p) {
    const cats = p._categorias || []
    return gastosDelMes
      .filter(g => cats.includes(g.categoria))
      .reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)
  }

  // Determinar si un usuario puede editar/eliminar
  function puedeModificar(p) {
    return isAdmin || p.owner_id === perfil?.id || !p.owner_id
  }

  const generales  = presupuestos.filter(p => p.tipo === 'general')
  const especificos = presupuestos.filter(p => p.tipo !== 'general')
  const totalPresupuestado = presupuestos.reduce((s, p) => s + Number(p.monto_mensual_rdp || 0), 0)
  const totalGastado       = presupuestos.reduce((s, p) => s + gastoPresupuesto(p), 0)
  const pctTotal           = totalPresupuestado > 0 ? (totalGastado / totalPresupuestado) * 100 : 0

  if (loading) return <div className="spinner-center"><div className="spinner"/></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
        <h2 style={{ fontWeight:700 }}>Presupuestos</h2>
        <button className="btn btn-primary" onClick={abrirNuevo}><Plus size={16}/> Nuevo</button>
      </div>

      {/* Resumen global */}
      {presupuestos.length > 0 && (
        <div style={S.summaryCard}>
          <div style={{ marginBottom:'.75rem' }}>
            <p style={{ fontSize:'.8rem', color:'rgba(255,255,255,.75)', marginBottom:'.2rem' }}>Resumen {mesLabel}</p>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <p style={{ fontSize:'1.6rem', fontWeight:800 }}>RD$ {fmtN(totalGastado)}</p>
              <p style={{ fontSize:'.9rem', opacity:.8 }}>de RD$ {fmtN(totalPresupuestado)}</p>
            </div>
          </div>
          <div style={{ height:8, background:'rgba(255,255,255,.25)', borderRadius:99 }}>
            <div style={{ height:'100%', borderRadius:99, width:`${Math.min(pctTotal,100)}%`,
              background: pctTotal>100?'#FCA5A5':pctTotal>80?'#FDE68A':'#BBF7D0' }}/>
          </div>
          <p style={{ fontSize:'.78rem', opacity:.8, marginTop:'.4rem', textAlign:'right' }}>
            {pctTotal.toFixed(0)}% del total usado
          </p>
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <form className="card" style={{ marginBottom:'1rem' }} onSubmit={handleSubmit}>
          <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
            <h3 style={{ fontWeight:600 }}>{editando ? '✏️ Editar presupuesto' : '📊 Nuevo presupuesto'}</h3>
            <button type="button" onClick={() => { setShowForm(false); setEditando(null) }} style={S.closeBtn}><X size={18}/></button>
          </div>

          {/* Nombre */}
          <div className="field">
            <label className="label">Nombre</label>
            <input className="input" placeholder="Ej: Gastos del hogar, Comida familia..."
              value={form.nombre} onChange={e => setF('nombre', e.target.value)} required/>
          </div>

          {/* Tipo */}
          <div className="field">
            <label className="label">Tipo</label>
            <div style={{ display:'flex', gap:'.5rem' }}>
              {[
                { v:'especifico', l:'📌 Específico', d:'Una categoría' },
                { v:'general',    l:'📦 General',    d:'Múltiples categorías' },
              ].map(({v,l,d}) => (
                <button key={v} type="button" onClick={() => setF('tipo', v)}
                  style={{ flex:1, padding:'.65rem', borderRadius:10, border:'1.5px solid', cursor:'pointer', textAlign:'center',
                    borderColor: form.tipo===v?'#2E6DA4':'#E5E7EB',
                    background:  form.tipo===v?'#EEF5FC':'var(--color-card,#fff)' }}>
                  <p style={{ fontWeight:700, fontSize:'.85rem', color:form.tipo===v?'#2E6DA4':'#1F2937' }}>{l}</p>
                  <p style={{ fontSize:'.7rem', color:'#9CA3AF', marginTop:'.1rem' }}>{d}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Categoría(s) */}
          {form.tipo === 'especifico' ? (
            <div className="field">
              <label className="label">Categoría</label>
              <select className="input" value={form.categoria} onChange={e => setF('categoria', e.target.value)} required>
                <option value="">Seleccionar</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{CATEG_ICONS[c]} {c}</option>)}
              </select>
            </div>
          ) : (
            <div className="field">
              <label className="label">Categorías incluidas ({form.categorias.length} seleccionadas)</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'.4rem', maxHeight:220, overflowY:'auto', paddingRight:'.25rem' }}>
                {CATEGORIAS.map(c => (
                  <button key={c} type="button" onClick={() => toggleCategoria(c)}
                    style={{ padding:'.45rem .25rem', borderRadius:9, border:'1.5px solid', cursor:'pointer',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:'.15rem',
                      borderColor: form.categorias.includes(c)?'#1B5E35':'#E5E7EB',
                      background:  form.categorias.includes(c)?'#D4EDDA':'var(--color-card,#fff)' }}>
                    <span style={{ fontSize:'1rem' }}>{CATEG_ICONS[c]}</span>
                    <span style={{ fontSize:'.58rem', fontWeight:600, textAlign:'center', lineHeight:1.2,
                      color: form.categorias.includes(c)?'#1B5E35':'#4B5563' }}>{c}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monto */}
          <div className="field">
            <label className="label">Presupuesto mensual (RD$)</label>
            <input className="input" type="number" placeholder="15,000" step="0.01"
              value={form.monto_mensual_rdp} onChange={e => setF('monto_mensual_rdp', e.target.value)} required/>
          </div>

          {/* Descuento automático */}
          <div className="field">
            <label className="label">Descuento al registrar gastos</label>
            <div style={{ display:'flex', gap:'.5rem' }}>
              {[
                { v:'auto',   l:'⚡ Automático', d:'Descuenta solo' },
                { v:'manual', l:'✋ Manual',      d:'Yo confirmo' },
              ].map(({v,l,d}) => (
                <button key={v} type="button" onClick={() => setF('descuento', v)}
                  style={{ flex:1, padding:'.6rem', borderRadius:10, border:'1.5px solid', cursor:'pointer', textAlign:'center',
                    borderColor: form.descuento===v?'#2E6DA4':'#E5E7EB',
                    background:  form.descuento===v?'#EEF5FC':'var(--color-card,#fff)' }}>
                  <p style={{ fontWeight:700, fontSize:'.82rem', color:form.descuento===v?'#2E6DA4':'#1F2937' }}>{l}</p>
                  <p style={{ fontSize:'.68rem', color:'#9CA3AF', marginTop:'.1rem' }}>{d}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Predeterminado — solo generales */}
          {form.tipo === 'general' && (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1rem',
              background:'#FFFBEB', borderRadius:10, padding:'.7rem .9rem', border:'1px solid #FDE68A' }}>
              <input type="checkbox" id="pred" checked={form.predeterminado}
                onChange={e => setF('predeterminado', e.target.checked)}
                style={{ width:18, height:18, cursor:'pointer', accentColor:'#D97706' }}/>
              <label htmlFor="pred" style={{ fontSize:'.9rem', cursor:'pointer', color:'#92400E', fontWeight:600 }}>
                ⭐ Establecer como presupuesto general predeterminado
              </label>
            </div>
          )}

          {/* Visibilidad */}
          <div className="field">
            <label className="label">Visibilidad</label>
            <div style={{ display:'flex', gap:'.75rem' }}>
              {[{v:'familiar',l:'👨‍👩‍👧 Familiar'},{v:'privada',l:'🔒 Privado'}].map(({v,l}) => (
                <button key={v} type="button" onClick={() => setF('visibilidad', v)}
                  style={{ flex:1, padding:'.6rem', borderRadius:10, border:'1.5px solid', cursor:'pointer',
                    fontWeight:600, fontSize:'.85rem', textAlign:'center',
                    borderColor: form.visibilidad===v?'#2E6DA4':'#E5E7EB',
                    background:  form.visibilidad===v?'#EEF5FC':'var(--color-card,#fff)',
                    color:       form.visibilidad===v?'#2E6DA4':'#4B5563' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Alertas */}
          <div style={{ display:'flex', flexDirection:'column', gap:'.5rem', marginBottom:'1rem' }}>
            <label className="label">Alertas por email</label>
            {[{id:'a80',val:'alerta_80',label:'Alertar al 80%'},{id:'a100',val:'alerta_100',label:'Alertar al 100%'}].map(a => (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
                <input type="checkbox" id={a.id} checked={form[a.val]==='true'}
                  onChange={e => setF(a.val, e.target.checked?'true':'false')}
                  style={{ width:18, height:18 }}/>
                <label htmlFor={a.id} style={{ fontSize:'.9rem', cursor:'pointer' }}>{a.label}</label>
              </div>
            ))}
          </div>

          {error && <div style={S.errorBox}>{error}</div>}
          <div style={{ display:'flex', gap:'.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear presupuesto'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditando(null) }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {presupuestos.length === 0 && !showForm ? (
        <div style={S.empty}>
          <span style={{ fontSize:'2.5rem' }}>📊</span>
          <p style={{ fontWeight:600 }}>No hay presupuestos configurados</p>
          <p style={{ fontSize:'.875rem', color:'#9CA3AF' }}>Crea presupuestos para controlar tus gastos</p>
        </div>
      ) : (
        <>
          {/* Presupuestos generales */}
          {generales.length > 0 && (
            <div style={{ marginBottom:'1.5rem' }}>
              <p style={S.secLabel}>📦 Presupuestos generales</p>
              {generales.map(p => (
                <PresupuestoCard key={p.id} p={p}
                  gastado={gastoPresupuesto(p)}
                  expanded={expandId === p.id}
                  onToggle={() => setExpandId(expandId===p.id?null:p.id)}
                  onEdit={() => abrirEditar(p)}
                  onDelete={() => setEliminando(p)}
                  onTogglePredeterminado={() => togglePredeterminado(p)}
                  puedeModificar={puedeModificar(p)}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}

          {/* Presupuestos específicos */}
          {especificos.length > 0 && (
            <div>
              <p style={S.secLabel}>📌 Presupuestos específicos</p>
              {especificos.map(p => (
                <PresupuestoCard key={p.id} p={p}
                  gastado={gastoPresupuesto(p)}
                  expanded={expandId === p.id}
                  onToggle={() => setExpandId(expandId===p.id?null:p.id)}
                  onEdit={() => abrirEditar(p)}
                  onDelete={() => setEliminando(p)}
                  onTogglePredeterminado={null}
                  puedeModificar={puedeModificar(p)}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </>
      )}

      {eliminando && (
        <ModalConfirmarEliminar
          item={{ ...eliminando, nombre: eliminando.nombre || eliminando.categoria }}
          tipo="presupuesto"
          onConfirm={handleEliminar}
          onCancel={() => setEliminando(null)}
        />
      )}
    </div>
  )
}

// ── Tarjeta de presupuesto ────────────────────────────────────────────────────
function PresupuestoCard({ p, gastado, expanded, onToggle, onEdit, onDelete, onTogglePredeterminado, puedeModificar, isAdmin }) {
  const limite      = Number(p.monto_mensual_rdp || 0)
  const pct         = limite > 0 ? (gastado / limite) * 100 : 0
  const color       = pct >= 100 ? '#DC2626' : pct >= 80 ? '#D97706' : '#1B5E35'
  const bgBar       = pct >= 100 ? '#DC2626' : pct >= 80 ? '#F59E0B' : '#2E6DA4'
  const esPred      = p.predeterminado === 'true'
  const esGeneral   = p.tipo === 'general'
  const cats        = p._categorias || []
  const esAuto      = (p.descuento || 'auto') === 'auto'

  return (
    <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:'.75rem' }}>
      {/* Cabecera */}
      <div style={{ padding:'1rem', cursor:'pointer' }} onClick={onToggle}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'.75rem', marginBottom:'.75rem' }}>
          {/* Icono */}
          <div style={{ width:44, height:44, borderRadius:12, flexShrink:0, fontSize:'1.3rem',
            background: esGeneral ? '#EEF5FC' : '#F3F4F6',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            {esGeneral ? '📦' : (CATEG_ICONS[cats[0]] || '💸')}
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'.4rem', flexWrap:'wrap' }}>
              <p style={{ fontWeight:700, fontSize:'.95rem' }}>{p.nombre || p.categoria}</p>
              {esPred && <span style={{ fontSize:'.65rem', background:'#FEF3C7', color:'#92400E', padding:'.1rem .4rem', borderRadius:99, fontWeight:700 }}>⭐ Predeterminado</span>}
              {!esAuto && <span style={{ fontSize:'.65rem', background:'#F3F4F6', color:'#6B7280', padding:'.1rem .4rem', borderRadius:99, fontWeight:600 }}>✋ Manual</span>}
              {p.visibilidad === 'privada' && <span style={{ fontSize:'.65rem', color:'#9CA3AF' }}>🔒</span>}
            </div>
            {/* Categorías resumidas */}
            <p style={{ fontSize:'.75rem', color:'#9CA3AF', marginTop:'.15rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {cats.slice(0,3).map(c => `${CATEG_ICONS[c] || ''} ${c}`).join(' · ')}
              {cats.length > 3 ? ` · +${cats.length - 3} más` : ''}
            </p>
          </div>

          {/* Acciones */}
          <div style={{ display:'flex', gap:'.25rem', flexShrink:0 }} onClick={e => e.stopPropagation()}>
            {onTogglePredeterminado && (isAdmin || puedeModificar) && (
              <button onClick={onTogglePredeterminado} title={esPred?'Quitar predeterminado':'Marcar como predeterminado'}
                style={{ ...S.iconBtn, color: esPred?'#D97706':'#9CA3AF' }}>
                {esPred ? <Star size={15} fill="#D97706"/> : <StarOff size={15}/>}
              </button>
            )}
            {puedeModificar && (
              <button onClick={onEdit} style={{ ...S.iconBtn, color:'#2E6DA4' }}><Pencil size={14}/></button>
            )}
            {(isAdmin || puedeModificar) && (
              <button onClick={onDelete} style={{ ...S.iconBtn, color:'#DC2626' }}><Trash2 size={14}/></button>
            )}
            <button onClick={onToggle} style={{ ...S.iconBtn, color:'#9CA3AF' }}>
              {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
          </div>
        </div>

        {/* Barra progreso */}
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.78rem', marginBottom:'.35rem' }}>
          <span style={{ color:'#9CA3AF' }}>RD$ {fmtN(gastado)} gastado</span>
          <span style={{ fontWeight:700, color }}>{pct.toFixed(0)}% de RD$ {fmtN(limite)}</span>
        </div>
        <div style={{ height:8, background:'var(--color-card-hover,#F3F4F6)', borderRadius:99 }}>
          <div style={{ height:'100%', borderRadius:99, width:`${Math.min(pct,100)}%`, background:bgBar, transition:'width .4s' }}/>
        </div>
        <p style={{ fontSize:'.75rem', marginTop:'.4rem', color: pct>=100?'#DC2626':'#6B7280' }}>
          {pct >= 100
            ? `⚠️ Excedido en RD$ ${fmtN(gastado - limite)}`
            : `Disponible: RD$ ${fmtN(limite - gastado)}`}
        </p>
      </div>

      {/* Detalle expandido — categorías */}
      {expanded && cats.length > 0 && (
        <div style={{ borderTop:'1px solid var(--color-border-secondary,#F3F4F6)', padding:'.75rem 1rem',
          background:'var(--color-card-hover,#F9FAFB)' }}>
          <p style={{ fontSize:'.72rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', marginBottom:'.5rem' }}>
            Categorías incluidas
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem' }}>
            {cats.map(c => {
              const gastoCat = 0 // podríamos calcular por categoría aquí
              return (
                <span key={c} style={{ display:'flex', alignItems:'center', gap:'.25rem',
                  background:'var(--color-card,#fff)', border:'1px solid var(--color-border,#E5E7EB)',
                  borderRadius:99, padding:'.2rem .6rem', fontSize:'.78rem', fontWeight:600 }}>
                  {CATEG_ICONS[c]} {c}
                </span>
              )
            })}
          </div>
          <div style={{ display:'flex', gap:'1rem', marginTop:'.75rem', fontSize:'.78rem' }}>
            <span style={{ color:'#9CA3AF' }}>
              Alertas: {p.alerta_80==='true'?'80%':''}{p.alerta_80==='true'&&p.alerta_100==='true'?' y ':''}{p.alerta_100==='true'?'100%':''}
              {p.alerta_80!=='true'&&p.alerta_100!=='true'?'Ninguna':''}
            </span>
            <span style={{ color:'#9CA3AF' }}>Descuento: {esAuto?'⚡ Automático':'✋ Manual'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

const fmtN = n => Number(n).toLocaleString('es-DO', { minimumFractionDigits:2 })
const S = {
  summaryCard: { background:'linear-gradient(135deg,#1E3A5F,#2E6DA4)', color:'#fff', borderRadius:16, padding:'1.1rem 1.25rem', marginBottom:'1.25rem', boxShadow:'0 6px 20px rgba(30,58,95,.3)' },
  secLabel:    { fontSize:'.75rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'.5rem' },
  closeBtn:    { background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', display:'flex' },
  iconBtn:     { background:'none', border:'none', cursor:'pointer', display:'flex', padding:'.25rem' },
  errorBox:    { background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'.65rem .9rem', fontSize:'.875rem', marginBottom:'.75rem' },
  empty:       { display:'flex', flexDirection:'column', alignItems:'center', gap:'.75rem', padding:'3rem 1rem', textAlign:'center', color:'var(--color-text,#1F2937)' },
}
