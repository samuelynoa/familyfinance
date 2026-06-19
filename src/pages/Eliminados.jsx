import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getTodosEliminados, restoreItem } from '../services/sheets'
import { Trash2, RotateCcw, Wallet, CreditCard, TrendingDown, PieChart } from 'lucide-react'

const HOJA_INFO = {
  cuentas:          { label: 'Cuenta',     icon: Wallet,       color: '#2E6DA4' },
  tarjetas_credito: { label: 'Tarjeta',    icon: CreditCard,   color: '#7A4800' },
  prestamos:        { label: 'Préstamo',   icon: TrendingDown, color: '#B91C1C' },
  presupuestos:     { label: 'Presupuesto',icon: PieChart,     color: '#1B5E35' },
}

export default function Eliminados() {
  const { perfil, isAdmin } = useAuth()
  const [items,       setItems]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [restaurando, setRestaurando] = useState(null)

  useEffect(() => { load() }, [perfil])

  async function load() {
    if (!perfil) return
    setLoading(true)
    try {
      const data = await getTodosEliminados({ usuarioId: perfil.id, isAdmin })
      setItems(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleRestore(item) {
    setRestaurando(item.id)
    try {
      await restoreItem(item._hoja, item.id)
      await load()
    } catch (e) {
      alert('Error al restaurar: ' + e.message)
    } finally { setRestaurando(null) }
  }

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Elementos eliminados</h2>

      {items.length === 0 ? (
        <div style={S.empty}>
          <Trash2 size={40} color="#9CA3AF" />
          <p style={{ fontWeight: 600 }}>No hay elementos eliminados</p>
          <p style={{ fontSize: '.875rem', color: '#9CA3AF' }}>
            Las cuentas, tarjetas, préstamos y presupuestos que elimines aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {items.map((item, i) => {
            const info = HOJA_INFO[item._hoja] || { label: item._hoja, icon: Trash2, color: '#6B7280' }
            const Icon = info.icon
            const nombre = item.nombre || item.categoria || 'Sin nombre'
            return (
              <div key={`${item._hoja}_${item.id}`} style={{
                display: 'flex', alignItems: 'center', gap: '.85rem', padding: '.9rem 1rem',
                borderBottom: i < items.length - 1 ? '1px solid var(--color-border-secondary,#F3F4F6)' : 'none',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                  background: info.color + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={19} color={info.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: '.9rem' }}>{nombre}</p>
                  <p style={{ fontSize: '.72rem', color: '#9CA3AF' }}>
                    {info.label} · Eliminado {item.eliminado_en ? new Date(item.eliminado_en).toLocaleDateString('es-DO') : ''}
                  </p>
                  {item.eliminado_motivo && (
                    <p style={{ fontSize: '.72rem', color: '#9CA3AF', fontStyle: 'italic', marginTop: '.1rem' }}>
                      "{item.eliminado_motivo}"
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRestore(item)}
                  disabled={restaurando === item.id}
                  style={S.restoreBtn}>
                  <RotateCcw size={14} />
                  {restaurando === item.id ? '...' : 'Restaurar'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const S = {
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.75rem',
    padding: '3rem 1rem', textAlign: 'center',
  },
  restoreBtn: {
    display: 'flex', alignItems: 'center', gap: '.35rem', flexShrink: 0,
    padding: '.45rem .75rem', borderRadius: 9, border: 'none', cursor: 'pointer',
    background: '#D4EDDA', color: '#1B5E35', fontWeight: 700, fontSize: '.78rem',
  },
}
