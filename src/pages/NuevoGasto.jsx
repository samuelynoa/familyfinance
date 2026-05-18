import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCuentas, getUsuarios, addGasto, addTransferencia, updateBalance, getSheet } from '../services/sheets'
import { CheckCircle, ChevronDown } from 'lucide-react'

const CATEGORIAS = [
  { label: 'Supermercado',              icon: '🛒', especial: null },
  { label: 'Combustible',               icon: '⛽', especial: null },
  { label: 'Educación',                 icon: '📚', especial: null },
  { label: 'Salud',                     icon: '🏥', especial: null },
  { label: 'Entretenimiento',           icon: '🎬', especial: null },
  { label: 'Servicios (agua/luz/internet)', icon: '💡', especial: null },
  { label: 'Comidas Fuera de Casa',     icon: '🍽️', especial: null },
  { label: 'Suscripciones',             icon: '📱', especial: null },
  { label: 'Mesada Familiar',           icon: '👨‍👩‍👧', especial: null },
  { label: 'Préstamos',                 icon: '🏦', especial: 'prestamo' },
  { label: 'Ahorros',                   icon: '💰', especial: 'ahorro' },
  { label: 'Salidas',                   icon: '🎉', especial: null },
  { label: 'Ropa',                      icon: '👗', especial: null },
  { label: 'Hogar',                     icon: '🏠', especial: null },
  { label: 'Vacaciones',                icon: '✈️', especial: null },
  { label: 'Mantenimiento Vehículo',    icon: '🚗', especial: null },
  { label: 'Deuda interna familiar',    icon: '🤝', especial: 'deuda_interna' },
]

export default function NuevoGasto() {
  const { perfil } = useAuth()
  const navigate   = useNavigate()

  const [cuentas,  setCuentas]  = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')

  const [form, setForm] = useState({
    fecha:            new Date().toISOString().split('T')[0],
    monto:            '',
    moneda:           'RD$',
    categoria:        '',
    descripcion:      '',
    comercio:         '',
    tipo:             'familiar',       // familiar | personal
    usuario_id:       '',
    cuenta_id:        '',
    usa_tarjeta:      false,
    tarjeta_id:       '',
    // Ahorro
    cuenta_destino_id: '',
    // Deuda interna
    beneficiario_id:  '',
  })

  const categoriaObj = CATEGORIAS.find(c => c.label === form.categoria)
  const esAhorro      = categoriaObj?.especial === 'ahorro'
  const esDeuda       = categoriaObj?.especial === 'deuda_interna'

  useEffect(() => {
    async function load() {
      try {
        const [c, u, t] = await Promise.all([
          getCuentas(),
          getUsuarios(),
          getSheet('tarjetas_credito'),
        ])
        setCuentas(c)
        setUsuarios(u)
        setTarjetas((t.rows || []).filter(r => r.activa === 'true'))
        // Pre-seleccionar usuario actual
        const yo = u.find(u => u.email === perfil?.email)
        if (yo) setForm(f => ({ ...f, usuario_id: yo.id }))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [perfil])

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const monto = Number(form.monto)
      if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a cero')
      if (!form.categoria)      throw new Error('Selecciona una categoría')
      if (!form.cuenta_id && !form.usa_tarjeta) throw new Error('Selecciona una cuenta o tarjeta')
      if (esAhorro && !form.cuenta_destino_id)  throw new Error('Selecciona la cuenta destino del ahorro')

      const montoRDP = form.moneda === 'RD$' ? monto : null
      const montoUSD = form.moneda === 'USD' ? monto : null

      // 1. Registrar el gasto
      const gastoId = await addGasto({
        fecha:             form.fecha,
        monto_rdp:         montoRDP,
        monto_usd:         montoUSD,
        categoria:         form.categoria,
        descripcion:       form.descripcion,
        comercio:          form.comercio,
        tipo:              form.tipo,
        usuario_id:        form.usuario_id,
        cuenta_id:         form.usa_tarjeta ? '' : form.cuenta_id,
        tarjeta_id:        form.usa_tarjeta ? form.tarjeta_id : '',
        es_ahorro:         esAhorro,
        cuenta_destino_id: esAhorro ? form.cuenta_destino_id : '',
        personal_familiar: form.tipo,
        confirmado_usuario: true,
        confianza_ia:      '1',
      })

      // 2. Descontar de la cuenta origen (si no es tarjeta de crédito ni solo consulta)
      if (!form.usa_tarjeta && form.cuenta_id) {
        const cuenta = cuentas.find(c => c.id === form.cuenta_id)
        if (cuenta && cuenta.solo_consulta !== 'true') {
          const balanceActual = Number(cuenta.balance || 0)
          const descuento     = montoRDP || (montoUSD * 1) // simplificado; fase 5 aplica tasa real
          await updateBalance(form.cuenta_id, balanceActual - descuento)
        }
      }

      // 3. Si es tarjeta, sumar al saldo_usado
      if (form.usa_tarjeta && form.tarjeta_id) {
        const tarjeta = tarjetas.find(t => t.id === form.tarjeta_id)
        if (tarjeta) {
          const usado = Number(tarjeta.saldo_usado || 0) + (montoRDP || montoUSD || 0)
          // Actualizar saldo_usado en la hoja tarjetas_credito
          const data = await getSheet('tarjetas_credito')
          const idx  = (data.rows || []).findIndex(r => r.id === form.tarjeta_id)
          if (idx !== -1) {
            const { updateRow } = await import('../services/sheets')
            await updateRow('tarjetas_credito', idx + 2, { ...tarjeta, saldo_usado: usado.toFixed(2) })
          }
        }
      }

      // 4. Si es ahorro, mover dinero a cuenta destino
      if (esAhorro && form.cuenta_destino_id) {
        await addTransferencia({
          cuenta_origen_id:  form.cuenta_id,
          cuenta_destino_id: form.cuenta_destino_id,
          monto:             montoRDP || montoUSD,
          moneda:            form.moneda,
          tipo:              'ahorro',
          descripcion:       `Ahorro: ${form.descripcion || form.fecha}`,
          usuario_id:        form.usuario_id,
          fecha:             form.fecha,
        })
        // Sumar a cuenta destino
        const cuentaDest = cuentas.find(c => c.id === form.cuenta_destino_id)
        if (cuentaDest) {
          await updateBalance(form.cuenta_destino_id, Number(cuentaDest.balance || 0) + (montoRDP || montoUSD || 0))
        }
      }

      // 5. Si es deuda interna, registrar
      if (esDeuda && form.beneficiario_id) {
        const { appendRow } = await import('../services/sheets')
        await appendRow('deudas_internas', {
          id:             `di_${Date.now()}`,
          fecha:          form.fecha,
          pagador_id:     form.usuario_id,
          beneficiario_id: form.beneficiario_id,
          monto:          montoRDP || montoUSD,
          descripcion:    form.descripcion || form.comercio || form.categoria,
          saldada:        'false',
          fecha_saldada:  '',
        })
      }

      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        navigate('/')
      }, 1500)

    } catch (err) {
      setError(err.message || 'Error al registrar el gasto.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  if (saved) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
      <CheckCircle size={64} color="#1B5E35" />
      <h2 style={{ fontWeight: 700, color: '#1B5E35' }}>¡Gasto registrado!</h2>
      <p style={{ color: '#9CA3AF' }}>Redirigiendo al inicio...</p>
    </div>
  )

  const cuentasOperativas = cuentas.filter(c => c.solo_consulta !== 'true')

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Nuevo gasto</h2>

      <form onSubmit={handleSubmit}>

        {/* Monto */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">Monto</label>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <select className="input" style={{ width: 90, flexShrink: 0 }}
                value={form.moneda} onChange={e => setF('moneda', e.target.value)}>
                <option value="RD$">RD$</option>
                <option value="USD">USD</option>
              </select>
              <input className="input" type="number" placeholder="0.00" step="0.01" min="0.01"
                value={form.monto} onChange={e => setF('monto', e.target.value)} required
                style={{ fontSize: '1.2rem', fontWeight: 700 }} />
            </div>
          </div>
        </div>

        {/* Categoría */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <label className="label">Categoría</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem' }}>
            {CATEGORIAS.map(c => (
              <button key={c.label} type="button"
                onClick={() => setF('categoria', c.label)}
                style={{
                  padding: '.6rem .4rem', borderRadius: 10, border: '1.5px solid',
                  borderColor: form.categoria === c.label ? '#2E6DA4' : '#E5E7EB',
                  background: form.categoria === c.label ? '#EEF5FC' : '#fff',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '.2rem',
                }}>
                <span style={{ fontSize: '1.3rem' }}>{c.icon}</span>
                <span style={{ fontSize: '.65rem', fontWeight: 600, color: form.categoria === c.label ? '#2E6DA4' : '#4B5563', textAlign: 'center', lineHeight: 1.2 }}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Detalles */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="grid-2">
            <div className="field">
              <label className="label">Fecha</label>
              <input className="input" type="date" value={form.fecha} onChange={e => setF('fecha', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">¿Quién gasta?</label>
              <select className="input" value={form.usuario_id} onChange={e => setF('usuario_id', e.target.value)}>
                <option value="">Seleccionar</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label">Comercio / Descripción</label>
            <input className="input" placeholder="Ej: La Sirena, Netflix..."
              value={form.comercio} onChange={e => setF('comercio', e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">Nota opcional</label>
            <input className="input" placeholder="Detalles adicionales..."
              value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} />
          </div>
        </div>

        {/* Personal / Familiar */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <label className="label">Tipo de gasto</label>
          <div style={{ display: 'flex', gap: '.75rem' }}>
            {['familiar', 'personal'].map(t => (
              <button key={t} type="button" onClick={() => setF('tipo', t)}
                style={{
                  flex: 1, padding: '.75rem', borderRadius: 10, border: '1.5px solid',
                  borderColor: form.tipo === t ? '#2E6DA4' : '#E5E7EB',
                  background: form.tipo === t ? '#EEF5FC' : '#fff',
                  cursor: 'pointer', fontWeight: 600, fontSize: '.9rem',
                  color: form.tipo === t ? '#2E6DA4' : '#4B5563',
                }}>
                {t === 'familiar' ? '👨‍👩‍👧 Familiar' : '👤 Personal'}
              </button>
            ))}
          </div>
        </div>

        {/* Pago — cuenta o tarjeta */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <label className="label">¿Cómo se pagó?</label>
          <div style={{ display: 'flex', gap: '.75rem', marginBottom: '.75rem' }}>
            <button type="button" onClick={() => setF('usa_tarjeta', false)}
              style={{
                flex: 1, padding: '.65rem', borderRadius: 10, border: '1.5px solid',
                borderColor: !form.usa_tarjeta ? '#2E6DA4' : '#E5E7EB',
                background: !form.usa_tarjeta ? '#EEF5FC' : '#fff',
                cursor: 'pointer', fontWeight: 600, fontSize: '.875rem',
                color: !form.usa_tarjeta ? '#2E6DA4' : '#4B5563',
              }}>
              🏦 Cuenta / Efectivo
            </button>
            <button type="button" onClick={() => setF('usa_tarjeta', true)}
              disabled={tarjetas.length === 0}
              style={{
                flex: 1, padding: '.65rem', borderRadius: 10, border: '1.5px solid',
                borderColor: form.usa_tarjeta ? '#2E6DA4' : '#E5E7EB',
                background: form.usa_tarjeta ? '#EEF5FC' : '#fff',
                cursor: tarjetas.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: '.875rem',
                color: form.usa_tarjeta ? '#2E6DA4' : '#4B5563',
                opacity: tarjetas.length === 0 ? .5 : 1,
              }}>
              💳 Tarjeta crédito
            </button>
          </div>

          {!form.usa_tarjeta ? (
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Cuenta</label>
              <select className="input" value={form.cuenta_id} onChange={e => setF('cuenta_id', e.target.value)}>
                <option value="">Seleccionar cuenta</option>
                {cuentasOperativas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — {c.moneda} {Number(c.balance || 0).toLocaleString('es-DO')}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Tarjeta</label>
              <select className="input" value={form.tarjeta_id} onChange={e => setF('tarjeta_id', e.target.value)}>
                <option value="">Seleccionar tarjeta</option>
                {tarjetas.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} — Disponible: {t.moneda} {(Number(t.limite) - Number(t.saldo_usado)).toLocaleString('es-DO')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Ahorro — cuenta destino */}
        {esAhorro && (
          <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #1B5E35' }}>
            <p style={{ fontWeight: 700, color: '#1B5E35', marginBottom: '.75rem' }}>💰 Transferencia de ahorro</p>
            <p style={{ fontSize: '.85rem', color: '#4B5563', marginBottom: '.75rem' }}>
              El dinero saldrá de la cuenta seleccionada arriba y se depositará en:
            </p>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Cuenta destino</label>
              <select className="input" value={form.cuenta_destino_id} onChange={e => setF('cuenta_destino_id', e.target.value)}>
                <option value="">Seleccionar cuenta destino</option>
                {cuentas.filter(c => c.id !== form.cuenta_id).map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Deuda interna — a quién le deben */}
        {esDeuda && (
          <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #7A4800' }}>
            <p style={{ fontWeight: 700, color: '#7A4800', marginBottom: '.75rem' }}>🤝 Deuda interna familiar</p>
            <p style={{ fontSize: '.85rem', color: '#4B5563', marginBottom: '.75rem' }}>
              Tú pagaste esto, pero otro miembro de la familia te debe reembolsar:
            </p>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">¿Quién te debe?</label>
              <select className="input" value={form.beneficiario_id} onChange={e => setF('beneficiario_id', e.target.value)}>
                <option value="">Seleccionar miembro</option>
                {usuarios.filter(u => u.id !== form.usuario_id).map(u => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && <div style={S.errorBox}>{error}</div>}

        <button type="submit" className="btn btn-primary btn-full"
          disabled={saving} style={{ padding: '1rem', fontSize: '1rem', marginTop: '.5rem' }}>
          {saving ? 'Guardando...' : '✓ Registrar gasto'}
        </button>
      </form>
    </div>
  )
}

const S = {
  errorBox: { background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.9rem', marginBottom: '1rem' },
}
