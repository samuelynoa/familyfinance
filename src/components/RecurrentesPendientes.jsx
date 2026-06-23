import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getSheet, appendRow, updateRow, updateBalance,
  addGasto, addTransferencia, getCuentas,
} from '../services/sheets'
import { CheckCircle, Clock, Zap } from 'lucide-react'

const CATEG_ICONS = {
  'Supermercado':'🛒','Combustible':'⛽','Educación':'📚','Salud':'🏥',
  'Entretenimiento':'🎬','Servicios (agua/luz/internet)':'💡','Comidas Fuera de Casa':'🍽️',
  'Suscripciones':'📱','Mesada Familiar':'👨‍👩‍👧','Préstamos':'🏦','Ahorros':'💰',
  'Salidas':'🎉','Ropa':'👗','Hogar':'🏠','Vacaciones':'✈️','Mantenimiento Vehículo':'🚗',
}

/**
 * Determina si un recurrente tiene un pendiente para hoy/este período
 */
function esPendienteHoy(r) {
  const hoy       = new Date()
  const inicio    = r.fecha_inicio ? new Date(r.fecha_inicio) : new Date(0)
  const fin       = r.fecha_fin    ? new Date(r.fecha_fin)    : new Date('2100-01-01')
  if (hoy < inicio || hoy > fin) return false
  if (r.activo !== 'true') return false

  const diaHoy = hoy.getDate()
  const mesHoy = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`

  switch (r.frecuencia) {
    case 'mensual':
      return Number(r.dia_del_mes) === diaHoy ||
        (Number(r.dia_del_mes) > new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate() && diaHoy === new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate())
    case 'quincenal':
      return diaHoy === Number(r.dia_del_mes) || diaHoy === Number(r.dia_del_mes) + 15
    case 'semanal': {
      const diaSemana = hoy.getDay() || 7 // 1=Lun ... 7=Dom
      return diaSemana === Number(r.dia_del_mes)
    }
    case 'anual':
      return diaHoy === Number(r.dia_del_mes) && hoy.getMonth() + 1 === Number(r.dia_del_mes_anual || 1)
    default:
      return false
  }
}

/**
 * Verifica si ya fue confirmado este período (hoy o este mes según frecuencia)
 */
function yaConfirmadoEstePeriodo(r, confirmados) {
  const hoy    = new Date()
  const mesHoy = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`
  return confirmados.some(c =>
    c.recurrente_id === r.id &&
    (r.frecuencia === 'semanal' || r.frecuencia === 'quincenal'
      ? c.fecha === hoy.toISOString().split('T')[0]
      : c.fecha?.startsWith(mesHoy))
  )
}

export default function RecurrentesPendientes({ onConfirmado }) {
  const { perfil, isAdmin } = useAuth()
  const [pendientes,   setPendientes]   = useState([])
  const [confirmados,  setConfirmados]  = useState([])
  const [cuentas,      setCuentas]      = useState([])
  const [tarjetas,     setTarjetas]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [confirmando,  setConfirmando]  = useState(null)
  const [okIds,        setOkIds]        = useState([])

  useEffect(() => { load() }, [perfil])

  async function load() {
    if (!perfil) return
    try {
      const [recData, gastosData, cuentaData, tarjData] = await Promise.all([
        getSheet('gastos_recurrentes'),
        getSheet('gastos'),
        getCuentas({ usuarioId: perfil.id, isAdmin }),
        getSheet('tarjetas_credito'),
      ])

      const todos = (recData.rows || []).filter(r =>
        r.activo === 'true' && (isAdmin || r.usuario_id === perfil.id)
      )

      // Gastos generados de recurrentes (tienen recurrente_id)
      const yaGenerados = (gastosData.rows || []).filter(g => g.recurrente_id)

      // Filtrar: pendientes del período actual
      const pend = todos.filter(r => esPendienteHoy(r) && !yaConfirmadoEstePeriodo(r, yaGenerados))
      const yaTodos = todos.filter(r => esPendienteHoy(r) && yaConfirmadoEstePeriodo(r, yaGenerados))

      setPendientes(pend)
      setConfirmados(yaTodos)
      setCuentas(cuentaData)
      setTarjetas((tarjData.rows || []).filter(t => t.activa === 'true'))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function confirmarRecurrente(r) {
    setConfirmando(r.id)
    try {
      const hoy   = new Date().toISOString().split('T')[0]
      const monto = Number(r.monto)
      const esTransferencia = r.tipo === 'transferencia'

      if (esTransferencia) {
        // Transferencia recurrente
        const origen  = cuentas.find(c => c.id === r.cuenta_id)
        const destino = cuentas.find(c => c.id === r.cuenta_destino_id)
        if (origen && destino) {
          await Promise.all([
            updateBalance(r.cuenta_id,         Number(origen.balance || 0) - monto),
            updateBalance(r.cuenta_destino_id,  Number(destino.balance || 0) + monto),
          ])
        }
        await addTransferencia({
          fecha:             hoy,
          cuenta_origen_id:  r.cuenta_id,
          cuenta_destino_id: r.cuenta_destino_id,
          monto,
          moneda:            r.moneda || 'RD$',
          tipo:              'recurrente',
          descripcion:       r.nombre,
          usuario_id:        perfil?.id,
          recurrente_id:     r.id,
        })
      } else {
        // Gasto recurrente
        await addGasto({
          fecha:             hoy,
          monto_rdp:         r.moneda === 'RD$' ? monto : null,
          monto_usd:         r.moneda === 'USD' ? monto : null,
          categoria:         r.categoria,
          subcategoria:      '',
          tipo:              r.personal_familiar || 'familiar',
          usuario_id:        perfil?.id,
          cuenta_id:         r.cuenta_id || '',
          tarjeta_id:        r.tarjeta_id || '',
          descripcion:       r.nombre,
          comercio:          r.nombre,
          es_ahorro:         'false',
          personal_familiar: r.personal_familiar || 'familiar',
          recurrente_id:     r.id,
        })

        // Actualizar saldo cuenta si aplica
        if (r.cuenta_id) {
          const cuenta = cuentas.find(c => c.id === r.cuenta_id)
          if (cuenta && cuenta.solo_consulta !== 'true') {
            await updateBalance(r.cuenta_id, Number(cuenta.balance || 0) - monto)
          }
        }

        // Actualizar saldo tarjeta si aplica
        if (r.tarjeta_id) {
          const tarjData = await getSheet('tarjetas_credito')
          const tIdx     = (tarjData.rows || []).findIndex(t => t.id === r.tarjeta_id)
          if (tIdx !== -1) {
            const t   = tarjData.rows[tIdx]
            const col = r.moneda === 'USD' ? 'saldo_usado_usd' : 'saldo_usado'
            await updateRow('tarjetas_credito', tIdx + 2, {
              ...t,
              [col]: (Number(t[col] || 0) + monto).toFixed(2),
            })
          }
        }
      }

      setOkIds(prev => [...prev, r.id])
      setTimeout(() => {
        setPendientes(prev => prev.filter(p => p.id !== r.id))
        setOkIds(prev => prev.filter(id => id !== r.id))
        onConfirmado?.()
      }, 1200)
    } catch (e) {
      console.error(e)
      alert('Error al confirmar: ' + e.message)
    } finally { setConfirmando(null) }
  }

  // También procesa automáticos
  useEffect(() => {
    if (!pendientes.length) return
    pendientes.filter(r => r.confirmacion === 'auto').forEach(r => {
      if (!okIds.includes(r.id) && confirmando !== r.id) {
        confirmarRecurrente(r)
      }
    })
  }, [pendientes])

  const manuales  = pendientes.filter(r => r.confirmacion !== 'auto')
  const yaHechos  = confirmados

  if (loading || (manuales.length === 0 && yaHechos.length === 0)) return null

  return (
    <div style={{ marginBottom:'1.5rem' }}>
      <h3 style={{ fontWeight:700, fontSize:'1rem', color:'var(--color-text,#1F2937)', marginBottom:'.75rem' }}>
        🔄 Recurrentes de hoy
      </h3>

      {manuales.map(r => {
        const esOk = okIds.includes(r.id)
        const cargando = confirmando === r.id
        const icon = r.tipo === 'transferencia' ? '↔️' : (CATEG_ICONS[r.categoria] || '💸')

        return (
          <div key={r.id} className="card" style={{
            display:'flex', alignItems:'center', gap:'.85rem', padding:'.85rem 1rem',
            marginBottom:'.6rem',
            border: esOk ? '1.5px solid #1B5E35' : '1px solid var(--color-border,#E5E7EB)',
          }}>
            <div style={{ width:40, height:40, borderRadius:11, background:'var(--color-card-hover,#F3F4F6)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>
              {icon}
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:600, fontSize:'.9rem' }}>{r.nombre}</p>
              <p style={{ fontSize:'.75rem', color:'#9CA3AF' }}>
                {r.categoria || r.tipo} · {r.moneda === 'USD' ? '$' : 'RD$'} {fmtN(Number(r.monto))}
              </p>
            </div>
            {esOk ? (
              <div style={{ display:'flex', alignItems:'center', gap:'.35rem', color:'#1B5E35', fontWeight:700, fontSize:'.82rem' }}>
                <CheckCircle size={18}/> ¡Listo!
              </div>
            ) : (
              <button
                onClick={() => confirmarRecurrente(r)}
                disabled={cargando}
                style={{ flexShrink:0, padding:'.5rem .9rem', borderRadius:9, border:'none',
                  cursor:'pointer', background:'#2E6DA4', color:'#fff', fontWeight:700, fontSize:'.82rem' }}>
                {cargando ? '...' : '✓ Confirmar'}
              </button>
            )}
          </div>
        )
      })}

      {yaHechos.length > 0 && (
        <p style={{ fontSize:'.75rem', color:'#9CA3AF', textAlign:'center', marginTop:'.25rem' }}>
          ✅ {yaHechos.length} recurrente{yaHechos.length !== 1 ? 's' : ''} ya confirmado{yaHechos.length !== 1 ? 's' : ''} hoy
        </p>
      )}
    </div>
  )
}

const fmtN = n => Number(n).toLocaleString('es-DO', { minimumFractionDigits:2 })
