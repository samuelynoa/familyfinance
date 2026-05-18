import { useEffect, useState } from 'react'
import { getGastos, getUsuarios } from '../services/sheets'
import { Filter, Search } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CATEG_ICONS = {
  'Supermercado':'🛒','Combustible':'⛽','Educación':'📚','Salud':'🏥',
  'Entretenimiento':'🎬','Servicios (agua/luz/internet)':'💡','Comidas Fuera de Casa':'🍽️',
  'Suscripciones':'📱','Mesada Familiar':'👨‍👩‍👧','Préstamos':'🏦','Ahorros':'💰',
  'Salidas':'🎉','Ropa':'👗','Hogar':'🏠','Vacaciones':'✈️',
  'Mantenimiento Vehículo':'🚗','Deuda interna familiar':'🤝',
}

export default function GastosLista() {
  const [gastos,   setGastos]   = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtros,  setFiltros]  = useState({
    mes:       format(new Date(), 'yyyy-MM'),
    categoria: '',
    tipo:      '',
    usuario:   '',
  })
  const [showFiltros, setShowFiltros] = useState(false)

  useEffect(() => { load() }, [filtros.mes])

  async function load() {
    setLoading(true)
    try {
      const [g, u] = await Promise.all([
        getGastos({ mes: filtros.mes }),
        getUsuarios(),
      ])
      setGastos(g)
      setUsuarios(u)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const usuarioMap = Object.fromEntries(usuarios.map(u => [u.id, u]))

  const filtrados = gastos.filter(g => {
    if (filtros.categoria && g.categoria !== filtros.categoria) return false
    if (filtros.tipo      && g.personal_familiar !== filtros.tipo) return false
    if (filtros.usuario   && g.usuario_id !== filtros.usuario) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (g.comercio || '').toLowerCase().includes(q) ||
             (g.descripcion || '').toLowerCase().includes(q) ||
             (g.categoria || '').toLowerCase().includes(q)
    }
    return true
  }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const totalFiltrado = filtrados.reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)

  const categorias = [...new Set(gastos.map(g => g.categoria).filter(Boolean))]

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700 }}>Gastos</h2>
        <button className="btn btn-secondary" style={{ padding: '.5rem .7rem' }}
          onClick={() => setShowFiltros(v => !v)}>
          <Filter size={18} />
        </button>
      </div>

      {/* Búsqueda */}
      <div style={{ position: 'relative', marginBottom: '.75rem' }}>
        <Search size={17} style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
        <input className="input" placeholder="Buscar comercio o descripción..."
          style={{ paddingLeft: '2.4rem' }}
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {/* Filtros */}
      {showFiltros && (
        <div className="card" style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          <div className="grid-2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Mes</label>
              <input className="input" type="month" value={filtros.mes}
                onChange={e => setFiltros(f => ({ ...f, mes: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Tipo</label>
              <select className="input" value={filtros.tipo}
                onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos</option>
                <option value="familiar">Familiar</option>
                <option value="personal">Personal</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Categoría</label>
              <select className="input" value={filtros.categoria}
                onChange={e => setFiltros(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">Todas</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Usuario</label>
              <select className="input" value={filtros.usuario}
                onChange={e => setFiltros(f => ({ ...f, usuario: e.target.value }))}>
                <option value="">Todos</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Resumen */}
      <div style={{ background: '#F3F4F6', borderRadius: 12, padding: '.75rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '.875rem', color: '#4B5563' }}>
          {filtrados.length} gasto{filtrados.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontWeight: 700, color: '#DC2626', fontSize: '.875rem' }}>
          RD$ {totalFiltrado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="spinner-center"><div className="spinner" /></div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '3rem 1rem' }}>
          <p style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🔍</p>
          <p>No hay gastos para este período</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtrados.map((g, i) => {
            const usuario = usuarioMap[g.usuario_id]
            const esTarjeta = !!g.tarjeta_id
            return (
              <div key={g.id || i} style={{
                display: 'flex', alignItems: 'center', padding: '.85rem 1rem', gap: '.85rem',
                borderBottom: i < filtrados.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}>
                {/* Icono */}
                <div style={{ width: 42, height: 42, borderRadius: 11, background: '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', flexShrink: 0 }}>
                  {CATEG_ICONS[g.categoria] || '💸'}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: '.9rem', color: '#1F2937',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.comercio || g.descripcion || g.categoria}
                  </p>
                  <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.72rem', color: '#9CA3AF' }}>{g.categoria}</span>
                    {esTarjeta && <span style={{ fontSize: '.68rem', background: '#EEF5FC', color: '#2E6DA4', padding: '.1rem .4rem', borderRadius: 99, fontWeight: 600 }}>💳 Tarjeta</span>}
                    {g.personal_familiar === 'personal' && usuario && (
                      <span style={{ fontSize: '.68rem', background: '#F3F4F6', color: '#4B5563', padding: '.1rem .4rem', borderRadius: 99 }}>
                        👤 {usuario.nombre?.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
                {/* Monto y fecha */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontWeight: 700, color: '#DC2626', fontSize: '.9rem' }}>
                    {g.monto_rdp ? `-RD$${Number(g.monto_rdp).toLocaleString('es-DO')}` : `-$${g.monto_usd}`}
                  </p>
                  <p style={{ fontSize: '.72rem', color: '#9CA3AF' }}>{g.fecha}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
