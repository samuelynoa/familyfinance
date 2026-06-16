import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getGastos, getUsuarios, deleteGasto, restoreGasto } from '../services/sheets'
import { Filter, Search, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CATEG_ICONS = {
  'Supermercado':'🛒','Combustible':'⛽','Educación':'📚','Salud':'🏥',
  'Entretenimiento':'🎬','Servicios (agua/luz/internet)':'💡','Comidas Fuera de Casa':'🍽️',
  'Suscripciones':'📱','Mesada Familiar':'👨‍👩‍👧','Préstamos':'🏦','Ahorros':'💰',
  'Salidas':'🎉','Ropa':'👗','Hogar':'🏠','Vacaciones':'✈️',
  'Mantenimiento Vehículo':'🚗','Deuda interna familiar':'🤝',
}

const fmtN = n => Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })

export default function GastosLista() {
  const { perfil, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [gastos,      setGastos]      = useState([])
  const [usuarios,    setUsuarios]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [busqueda,    setBusqueda]    = useState('')
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtros, setFiltros] = useState({
    mes: format(new Date(), 'yyyy-MM'), categoria: '', tipo: '', usuario: '',
  })

  // Eliminar / undo
  const [confirmDelete, setConfirmDelete] = useState(null) // gasto a confirmar
  const [deleting,      setDeleting]      = useState(false)
  const [toast,         setToast]         = useState(null) // { gasto, timer }

  useEffect(() => { load() }, [filtros.mes, perfil])

  // Limpiar timer al desmontar
  useEffect(() => () => { if (toast?.timer) clearTimeout(toast.timer) }, [toast])

  async function load() {
    if (!perfil) return
    setLoading(true)
    try {
      const [g, u] = await Promise.all([getGastos({ mes: filtros.mes }), getUsuarios()])
      const visibles = isAdmin
        ? g.filter(x => x.eliminado_soft !== 'true')
        : g.filter(x => {
            if (x.eliminado_soft === 'true') return false
            const esFamiliar = x.personal_familiar === 'familiar' || !x.personal_familiar
            return esFamiliar || x.usuario_id === perfil.id
          })
      setGastos(visibles)
      setUsuarios(u)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // ── Editar ───────────────────────────────────────────────────────────────
  function handleEditar(gasto) {
    // Navegar a NuevoGasto con el gasto como estado para edición
    navigate('/gastos/nuevo', { state: { gastoEditar: gasto } })
  }

  // ── Eliminar con undo ────────────────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const gastoEliminado = await deleteGasto(confirmDelete.id, { eliminadoPor: perfil?.id })
      setGastos(prev => prev.filter(g => g.id !== confirmDelete.id))
      setConfirmDelete(null)

      // Iniciar toast con undo (8 segundos)
      const timer = setTimeout(async () => {
        setToast(null)
      }, 8000)

      setToast({ gasto: gastoEliminado || confirmDelete, timer })
    } catch (e) {
      console.error(e)
      alert('Error al eliminar. Intenta de nuevo.')
    } finally { setDeleting(false) }
  }

  async function handleUndo() {
    if (!toast) return
    clearTimeout(toast.timer)
    try {
      await restoreGasto(toast.gasto.id)
      setToast(null)
      load() // recargar para mostrar el gasto restaurado
    } catch (e) {
      console.error(e)
      setToast(null)
    }
  }

  // ── Filtros ──────────────────────────────────────────────────────────────
  const usuarioMap = Object.fromEntries(usuarios.map(u => [u.id, u]))

  const filtrados = gastos.filter(g => {
    if (filtros.categoria && g.categoria !== filtros.categoria) return false
    if (filtros.tipo      && g.personal_familiar !== filtros.tipo) return false
    if (filtros.usuario   && g.usuario_id !== filtros.usuario) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (g.comercio||'').toLowerCase().includes(q)
          || (g.descripcion||'').toLowerCase().includes(q)
          || (g.categoria||'').toLowerCase().includes(q)
    }
    return true
  }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const totalFiltrado = filtrados.reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)
  const categorias    = [...new Set(gastos.map(g => g.categoria).filter(Boolean))]

  // ¿Puede este usuario editar/eliminar este gasto?
  function puedeModificar(gasto) {
    return isAdmin || gasto.usuario_id === perfil?.id
  }

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="flex justify-between items-center" style={{ marginBottom:'1rem' }}>
        <h2 style={{ fontWeight:700 }}>Gastos</h2>
        <button className="btn btn-secondary" style={{ padding:'.5rem .7rem' }}
          onClick={() => setShowFiltros(v => !v)}>
          <Filter size={18}/>
        </button>
      </div>

      {/* Búsqueda */}
      <div style={{ position:'relative', marginBottom:'.75rem' }}>
        <Search size={17} style={{ position:'absolute', left:'.75rem', top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }}/>
        <input className="input" placeholder="Buscar comercio o descripción..."
          style={{ paddingLeft:'2.4rem' }}
          value={busqueda} onChange={e => setBusqueda(e.target.value)}/>
      </div>

      {/* Filtros */}
      {showFiltros && (
        <div className="card" style={{ marginBottom:'1rem', display:'flex', flexDirection:'column', gap:'.75rem' }}>
          <div className="grid-2">
            <div className="field" style={{ marginBottom:0 }}>
              <label className="label">Mes</label>
              <input className="input" type="month" value={filtros.mes}
                onChange={e => setFiltros(f => ({ ...f, mes: e.target.value }))}/>
            </div>
            <div className="field" style={{ marginBottom:0 }}>
              <label className="label">Tipo</label>
              <select className="input" value={filtros.tipo}
                onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos</option>
                <option value="familiar">👨‍👩‍👧 Familiar</option>
                <option value="personal">👤 Personal</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field" style={{ marginBottom:0 }}>
              <label className="label">Categoría</label>
              <select className="input" value={filtros.categoria}
                onChange={e => setFiltros(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">Todas</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div className="field" style={{ marginBottom:0 }}>
                <label className="label">Usuario</label>
                <select className="input" value={filtros.usuario}
                  onChange={e => setFiltros(f => ({ ...f, usuario: e.target.value }))}>
                  <option value="">Todos</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resumen */}
      <div style={{ background:'var(--color-card-hover,#F3F4F6)', borderRadius:12, padding:'.75rem 1rem', marginBottom:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'.875rem', color:'var(--color-text-secondary,#4B5563)' }}>
          {filtrados.length} gasto{filtrados.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontWeight:700, color:'#DC2626', fontSize:'.875rem' }}>
          RD$ {fmtN(totalFiltrado)}
        </span>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="spinner-center"><div className="spinner"/></div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign:'center', color:'#9CA3AF', padding:'3rem 1rem' }}>
          <p style={{ fontSize:'2rem', marginBottom:'.5rem' }}>🔍</p>
          <p>No hay gastos para este período</p>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {filtrados.map((g, i) => {
            const usuario   = usuarioMap[g.usuario_id]
            const esTarjeta = !!g.tarjeta_id
            const esMio     = g.usuario_id === perfil?.id
            const puedeMod  = puedeModificar(g)
            const fueEditado = !!g.editado_en

            return (
              <div key={g.id || i} style={{
                borderBottom: i < filtrados.length-1 ? '1px solid var(--color-border-secondary,#F3F4F6)' : 'none',
              }}>
                <div style={{ display:'flex', alignItems:'center', padding:'.85rem 1rem', gap:'.85rem' }}>
                  {/* Ícono categoría */}
                  <div style={{ width:42, height:42, borderRadius:11,
                    background:'var(--color-card-hover,#F3F4F6)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'1.2rem', flexShrink:0 }}>
                    {CATEG_ICONS[g.categoria] || '💸'}
                  </div>

                  {/* Descripción */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
                      <p style={{ fontWeight:600, fontSize:'.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--color-text,#1F2937)' }}>
                        {g.comercio || g.descripcion || g.categoria}
                      </p>
                      {fueEditado && (
                        <span style={{ fontSize:'.65rem', color:'#9CA3AF', flexShrink:0 }}>✏️</span>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:'.4rem', alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'.72rem', color:'var(--color-text-muted,#9CA3AF)' }}>{g.categoria}</span>
                      {esTarjeta && (
                        <span style={{ fontSize:'.68rem', background:'#EEF5FC', color:'#2E6DA4', padding:'.1rem .4rem', borderRadius:99, fontWeight:600 }}>
                          💳 Tarjeta
                        </span>
                      )}
                      {g.personal_familiar === 'personal' ? (
                        <span style={{ fontSize:'.68rem', background:'#EDE9FE', color:'#5B21B6', padding:'.1rem .4rem', borderRadius:99, fontWeight:600 }}>
                          👤 {esMio ? 'Mío' : usuario?.nombre?.split(' ')[0] || 'Personal'}
                        </span>
                      ) : (
                        <span style={{ fontSize:'.68rem', background:'#D4EDDA', color:'#1B5E35', padding:'.1rem .4rem', borderRadius:99, fontWeight:600 }}>
                          👨‍👩‍👧 Familiar
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Monto */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontWeight:700, color:'#DC2626', fontSize:'.9rem' }}>
                      {g.monto_rdp ? `-RD$${fmtN(Number(g.monto_rdp))}` : `-$${g.monto_usd}`}
                    </p>
                    <p style={{ fontSize:'.72rem', color:'var(--color-text-muted,#9CA3AF)' }}>{g.fecha}</p>
                  </div>

                  {/* Acciones */}
                  {puedeMod && (
                    <div style={{ display:'flex', flexDirection:'column', gap:'.25rem', flexShrink:0 }}>
                      <button onClick={() => handleEditar(g)} title="Editar"
                        style={{ ...S.actionBtn, color:'#2E6DA4', background:'#EEF5FC' }}>
                        <Pencil size={14}/>
                      </button>
                      <button onClick={() => setConfirmDelete(g)} title="Eliminar"
                        style={{ ...S.actionBtn, color:'#DC2626', background:'#FEE2E2' }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  )}
                </div>

                {/* Info de auditoría (solo si fue editado) */}
                {fueEditado && (
                  <div style={{ padding:'.2rem 1rem .4rem 5rem', fontSize:'.68rem', color:'#9CA3AF' }}>
                    Editado {g.editado_en ? new Date(g.editado_en).toLocaleDateString('es-DO') : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal confirmación eliminar */}
      {confirmDelete && (
        <div style={S.overlay} onClick={() => !deleting && setConfirmDelete(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1rem' }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'#FEE2E2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <AlertTriangle size={22} color="#DC2626"/>
              </div>
              <div>
                <p style={{ fontWeight:700, fontSize:'1rem' }}>¿Eliminar gasto?</p>
                <p style={{ fontSize:'.82rem', color:'#6B7280', marginTop:'.15rem' }}>
                  Tendrás 8 segundos para deshacer la acción.
                </p>
              </div>
            </div>

            {/* Detalle del gasto */}
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:'.75rem 1rem', marginBottom:'1.25rem' }}>
              <p style={{ fontWeight:600 }}>{confirmDelete.comercio || confirmDelete.descripcion || confirmDelete.categoria}</p>
              <p style={{ fontSize:'.82rem', color:'#6B7280' }}>{confirmDelete.categoria} · {confirmDelete.fecha}</p>
              <p style={{ fontWeight:700, color:'#DC2626', marginTop:'.35rem' }}>
                RD$ {fmtN(Number(confirmDelete.monto_rdp || 0))}
              </p>
            </div>

            <div style={{ display:'flex', gap:'.75rem' }}>
              <button onClick={handleConfirmDelete} disabled={deleting}
                style={{ flex:1, padding:'.75rem', borderRadius:10, border:'none', cursor:'pointer',
                  background:'#DC2626', color:'#fff', fontWeight:700, fontSize:'.9rem' }}>
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                style={{ flex:1, padding:'.75rem', borderRadius:10, border:'1.5px solid #E5E7EB',
                  cursor:'pointer', background:'#fff', fontWeight:600, fontSize:'.9rem', color:'#4B5563' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast undo */}
      {toast && (
        <div style={S.toast}>
          <div style={{ flex:1 }}>
            <p style={{ fontWeight:600, fontSize:'.875rem' }}>Gasto eliminado</p>
            <p style={{ fontSize:'.78rem', color:'rgba(255,255,255,.75)', marginTop:'.1rem' }}>
              {toast.gasto?.comercio || toast.gasto?.categoria}
            </p>
          </div>
          <button onClick={handleUndo} style={S.undoBtn}>
            Deshacer
          </button>
          <button onClick={() => { clearTimeout(toast.timer); setToast(null) }}
            style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.6)', padding:'.25rem' }}>
            <X size={16}/>
          </button>
        </div>
      )}
    </div>
  )
}

const S = {
  actionBtn: {
    width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 1000, padding: '1rem',
  },
  modal: {
    background: '#fff', borderRadius: 20, padding: '1.5rem',
    width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.3)',
    animation: 'slideUp .2s ease',
  },
  toast: {
    position: 'fixed', bottom: '5rem', left: '1rem', right: '1rem',
    background: '#1F2937', color: '#fff', borderRadius: 14,
    padding: '.85rem 1rem', display: 'flex', alignItems: 'center', gap: '.75rem',
    zIndex: 999, boxShadow: '0 8px 30px rgba(0,0,0,.35)',
    animation: 'slideUp .25s ease',
  },
  undoBtn: {
    background: '#2E6DA4', color: '#fff', border: 'none', borderRadius: 8,
    padding: '.4rem .85rem', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer',
    flexShrink: 0,
  },
}
