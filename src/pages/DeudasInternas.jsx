import { useEffect, useState } from 'react'
import { getSheet, updateRow, getUsuarios } from '../services/sheets'
import { CheckCircle, Clock, Users } from 'lucide-react'

export default function DeudasInternas() {
  const [deudas,   setDeudas]   = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [d, u] = await Promise.all([getSheet('deudas_internas'), getUsuarios()])
      setDeudas((d.rows || []).filter(r => r.saldada !== 'true'))
      setUsuarios(u)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function saldar(deuda, idx) {
    setSaving(deuda.id)
    try {
      const data   = await getSheet('deudas_internas')
      const rowIdx = (data.rows || []).findIndex(r => r.id === deuda.id)
      if (rowIdx !== -1) {
        await updateRow('deudas_internas', rowIdx + 2, {
          ...deuda,
          saldada:       'true',
          fecha_saldada: new Date().toISOString().split('T')[0],
        })
      }
      await load()
    } catch (e) { console.error(e) }
    finally { setSaving(null) }
  }

  const usuarioMap = Object.fromEntries(usuarios.map(u => [u.id, u]))

  // Agrupar deudas por pagador
  const porPagador = deudas.reduce((acc, d) => {
    const key = d.pagador_id
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Deudas familiares</h2>

      {deudas.length === 0 ? (
        <div style={S.empty}>
          <CheckCircle size={48} color="#1B5E35" />
          <p style={{ fontWeight: 700, color: '#1B5E35', fontSize: '1.1rem' }}>¡Todo saldado!</p>
          <p style={{ color: '#9CA3AF', fontSize: '.875rem' }}>No hay deudas pendientes entre miembros</p>
        </div>
      ) : (
        Object.entries(porPagador).map(([pagadorId, deudasPagador]) => {
          const pagador = usuarioMap[pagadorId]
          const totalDebe = deudasPagador.reduce((s, d) => s + Number(d.monto || 0), 0)
          return (
            <div key={pagadorId} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.75rem' }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: pagador?.avatar_color || '#2E6DA4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '.8rem',
                }}>
                  {pagador?.nombre?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </div>
                <div>
                  <p style={{ fontWeight: 700 }}>{pagador?.nombre || 'Desconocido'} pagó</p>
                  <p style={{ fontSize: '.78rem', color: '#9CA3AF' }}>
                    Total pendiente: RD$ {Number(totalDebe).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                {deudasPagador.map((d, i) => {
                  const beneficiario = usuarioMap[d.beneficiario_id]
                  return (
                    <div key={d.id} className="card" style={{ padding: '.9rem 1rem', display: 'flex', alignItems: 'center', gap: '.85rem' }}>
                      <Clock size={18} color="#D97706" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: '.9rem' }}>{d.descripcion || 'Sin descripción'}</p>
                        <p style={{ fontSize: '.75rem', color: '#9CA3AF' }}>
                          {beneficiario?.nombre || 'Desconocido'} debe reembolsar · {d.fecha}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontWeight: 700, color: '#D97706', fontSize: '.9rem' }}>
                          RD$ {Number(d.monto || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </p>
                        <button
                          onClick={() => saldar(d, i)}
                          disabled={saving === d.id}
                          style={{
                            fontSize: '.72rem', fontWeight: 700,
                            color: '#1B5E35', background: '#D4EDDA',
                            border: 'none', borderRadius: 99,
                            padding: '.2rem .6rem', cursor: 'pointer', marginTop: '.2rem',
                          }}>
                          {saving === d.id ? '...' : '✓ Saldar'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

const S = {
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.75rem', padding: '3rem 1rem', textAlign: 'center' },
}
