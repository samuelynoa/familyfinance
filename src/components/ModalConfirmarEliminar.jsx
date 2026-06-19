import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

/**
 * Modal de confirmación fuerte para eliminar elementos.
 * Requiere que el usuario escriba el nombre del elemento para confirmar.
 *
 * Props:
 * - item: { id, nombre } — el elemento a eliminar
 * - tipo: 'cuenta' | 'tarjeta' | 'préstamo' | 'presupuesto'
 * - onConfirm: (motivo: string) => Promise<void>
 * - onCancel: () => void
 * - advertencia: texto extra opcional (ej: "Tiene N gastos vinculados")
 */
export default function ModalConfirmarEliminar({ item, tipo, onConfirm, onCancel, advertencia }) {
  const [texto,    setTexto]    = useState('')
  const [motivo,   setMotivo]   = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState('')

  const nombreEsperado = item?.nombre || item?.categoria || ''
  const coincide = texto.trim().toLowerCase() === nombreEsperado.trim().toLowerCase()

  async function handleConfirm() {
    if (!coincide) { setError('El texto no coincide'); return }
    setDeleting(true); setError('')
    try {
      await onConfirm(motivo)
    } catch (e) {
      setError(e.message || 'Error al eliminar')
      setDeleting(false)
    }
  }

  return (
    <div style={S.overlay} onClick={() => !deleting && onCancel()}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={22} color="#DC2626" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: '1rem' }}>Eliminar {tipo}</p>
            <p style={{ fontSize: '.82rem', color: '#6B7280', marginTop: '.1rem' }}>Esta acción se puede deshacer luego</p>
          </div>
          <button onClick={onCancel} style={S.closeBtn}><X size={18} /></button>
        </div>

        {advertencia && (
          <div style={S.warnBox}>{advertencia}</div>
        )}

        <p style={{ fontSize: '.875rem', color: '#374151', marginBottom: '.5rem' }}>
          Para confirmar, escribe <strong>{nombreEsperado}</strong>:
        </p>
        <input
          className="input"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={nombreEsperado}
          style={{ marginBottom: '.85rem' }}
          autoFocus
        />

        <label className="label">Motivo (opcional)</label>
        <input
          className="input"
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ej: cuenta cerrada, duplicada..."
          style={{ marginBottom: '1.1rem' }}
        />

        {error && <div style={S.errorBox}>{error}</div>}

        <div style={{ display: 'flex', gap: '.75rem' }}>
          <button
            onClick={handleConfirm}
            disabled={!coincide || deleting}
            style={{
              flex: 1, padding: '.75rem', borderRadius: 10, border: 'none',
              cursor: coincide ? 'pointer' : 'not-allowed',
              background: coincide ? '#DC2626' : '#FCA5A5',
              color: '#fff', fontWeight: 700, fontSize: '.9rem',
            }}>
            {deleting ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              flex: 1, padding: '.75rem', borderRadius: 10, border: '1.5px solid #E5E7EB',
              cursor: 'pointer', background: '#fff', fontWeight: 600, fontSize: '.9rem', color: '#4B5563',
            }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 1000, padding: '1rem',
  },
  modal: {
    background: 'var(--color-card,#fff)', borderRadius: 20, padding: '1.5rem',
    width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.3)',
  },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', flexShrink: 0 },
  warnBox: {
    background: '#FFFBEB', color: '#92400E', borderRadius: 8,
    padding: '.65rem .9rem', fontSize: '.82rem', marginBottom: '1rem',
  },
  errorBox: {
    background: '#FEE2E2', color: '#DC2626', borderRadius: 8,
    padding: '.65rem .9rem', fontSize: '.875rem', marginBottom: '.75rem',
  },
}
