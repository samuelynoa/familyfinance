import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getCuentas, getUsuarios, addGasto, updateGasto, addTransferencia, getGastos,
  updateBalance, getSheet, appendRow, updateRow, getComercios, upsertComercio,
} from '../services/sheets'
import { processReceiptImage } from '../services/ocr'
import {
  Camera, FileText, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, X, Zap,
} from 'lucide-react'

const CATEGORIAS = [
  { label: 'Supermercado',                  icon: '🛒' },
  { label: 'Combustible',                   icon: '⛽' },
  { label: 'Educación',                     icon: '📚' },
  { label: 'Salud',                         icon: '🏥' },
  { label: 'Entretenimiento',               icon: '🎬' },
  { label: 'Servicios (agua/luz/internet)', icon: '💡' },
  { label: 'Comidas Fuera de Casa',         icon: '🍽️' },
  { label: 'Suscripciones',                 icon: '📱' },
  { label: 'Mesada Familiar',               icon: '👨‍👩‍👧' },
  { label: 'Préstamos',                     icon: '🏦', especial: 'prestamo' },
  { label: 'Ahorros',                       icon: '💰', especial: 'ahorro' },
  { label: 'Salidas',                       icon: '🎉' },
  { label: 'Ropa',                          icon: '👗' },
  { label: 'Hogar',                         icon: '🏠' },
  { label: 'Vacaciones',                    icon: '✈️' },
  { label: 'Mantenimiento Vehículo',        icon: '🚗' },
  { label: 'Deuda interna familiar',        icon: '🤝', especial: 'deuda_interna' },
]

// ─── Modos de entrada ────────────────────────────────────────────────────────
const MODO_SELECCION  = 'seleccion'   // pantalla inicial: foto o manual
const MODO_OCR        = 'ocr'         // procesando imagen
const MODO_CONFIRMAR  = 'confirmar'   // IA sugiere, usuario confirma
const MODO_MANUAL     = 'manual'      // formulario manual
const MODO_GUARDADO   = 'guardado'    // éxito


export default function NuevoGasto() {
  const { perfil, isAdmin }  = useAuth()
  const navigate    = useNavigate()
  const location    = useLocation()
  const { id }      = useParams() // 2. Captura el ID de la URL si existe
  const gastoEditar = location.state?.gastoEditar || null
  const modoEdicion = !!gastoEditar || !!id
  const fileInputRef = useRef(null)

  const [modo,      setModo]     = useState(MODO_SELECCION)
  const [cuentas,   setCuentas]  = useState([])
  const [usuarios,  setUsuarios] = useState([])
  const [tarjetas,  setTarjetas] = useState([])
  const [comercios, setComercios] = useState([])
  const [loading,   setLoading]  = useState(true)
  const [saving,    setSaving]   = useState(false)
  const [error,     setError]    = useState('')
  const [ocrStatus, setOcrStatus] = useState('') // mensaje de progreso OCR

  // Resultado de la IA (modo confirmar)
  const [sugerencia, setSugerencia] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)

  // Formulario
  const [form, setForm] = useState({
    fecha:             new Date().toISOString().split('T')[0],
    monto:             '',
    moneda:            'RD$',
    categoria:         '',
    descripcion:       '',
    comercio:          '',
    tipo:              'familiar',
    usuario_id:        '',
    cuenta_id:         '',
    usa_tarjeta:       false,
    tarjeta_id:        '',
    cuenta_destino_id: '',
    beneficiario_id:   '',
  })

  const categoriaObj  = CATEGORIAS.find(c => c.label === form.categoria)
  const esAhorro      = categoriaObj?.especial === 'ahorro'
  const esDeuda       = categoriaObj?.especial === 'deuda_interna'

  useEffect(() => {
    async function load() {
      try {
        const [c, u, t, com] = await Promise.all([
          getCuentas({ usuarioId: perfil?.id, isAdmin }), getUsuarios(),
          getSheet('tarjetas_credito'), getComercios(),
        ])
        setCuentas(c)
        setUsuarios(u)
        setTarjetas((t.rows || []).filter(r => r.activa === 'true'))
        setComercios(com)
        const yo = u.find(u => u.email === perfil?.email)
        if (yo) setForm(f => ({ ...f, usuario_id: yo.id }))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [perfil])

  // Pre-llenar formulario en modo edición
  useEffect(() => {
    if (!gastoEditar || loading) return
    setForm({
      fecha:             gastoEditar.fecha || new Date().toISOString().split('T')[0],
      monto:             gastoEditar.monto_rdp || gastoEditar.monto_usd || '',
      moneda:            (gastoEditar.monto_usd && !gastoEditar.monto_rdp) ? 'USD' : 'RD$',
      categoria:         gastoEditar.categoria || '',
      descripcion:       gastoEditar.descripcion || '',
      comercio:          gastoEditar.comercio || '',
      tipo:              gastoEditar.personal_familiar || 'familiar',
      usuario_id:        gastoEditar.usuario_id || '',
      cuenta_id:         gastoEditar.cuenta_id || '',
      usa_tarjeta:       !!gastoEditar.tarjeta_id,
      tarjeta_id:        gastoEditar.tarjeta_id || '',
      cuenta_destino_id: gastoEditar.cuenta_destino_id || '',
      beneficiario_id:   gastoEditar.beneficiario_id || '',
    })
    setModo(MODO_MANUAL)
  }, [gastoEditar, loading])

  // ─── OCR: usuario selecciona imagen ────────────────────────────────────────
  async function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset para permitir re-seleccionar el mismo archivo

    // Preview
    const previewUrl = URL.createObjectURL(file)
    setImagenPreview(previewUrl)
    setModo(MODO_OCR)
    setError('')

    try {
      setOcrStatus('📷 Preparando imagen...')
      // Tesseract da progreso real

      // progreso via callback
      const resultado = await processReceiptImage(file, comercios, setOcrStatus)

      // clasificando...
      // sin delay

      // Llenar el formulario con los datos extraídos
      setSugerencia(resultado)
      setForm(f => ({
        ...f,
        monto:    resultado.monto ? String(resultado.monto) : '',
        moneda:   resultado.moneda || 'RD$',
        comercio: resultado.comercio || '',
        fecha:    resultado.fecha || f.fecha,
        categoria: resultado.categoria || '',
      }))

      setModo(MODO_CONFIRMAR)
      setOcrStatus('')
    } catch (err) {
      setError(err.message || 'Error procesando la imagen')
      setModo(MODO_SELECCION)
      setOcrStatus('')
      URL.revokeObjectURL(previewUrl)
      setImagenPreview(null)
    }
  }

  // ─── Guardar gasto ──────────────────────────────────────────────────────────
  async function handleGuardar(e) {
    e?.preventDefault()
    setError('')
    setSaving(true)
    try {
      const monto = Number(form.monto)
      if (!monto || monto <= 0)                throw new Error('El monto debe ser mayor a cero')
      if (!form.categoria)                     throw new Error('Selecciona una categoría')
      if (!form.cuenta_id && !form.usa_tarjeta) throw new Error('Selecciona una cuenta o tarjeta')
      if (esAhorro && !form.cuenta_destino_id) throw new Error('Selecciona la cuenta destino del ahorro')

      const montoRDP = form.moneda === 'RD$' ? monto : null
      const montoUSD = form.moneda === 'USD' ? monto : null
      const confianza = sugerencia?.confianza || 1

      // 1a. MODO EDICIÓN — actualizar gasto existente
      if (modoEdicion) {
        const montoAnterior = Number(gastoEditar.monto_rdp || gastoEditar.monto_usd || 0)
        const montoNuevo    = montoRDP || montoUSD || 0
        await updateGasto(gastoEditar.id, {
          fecha:             form.fecha,
          monto_rdp:         montoRDP,
          monto_usd:         montoUSD,
          categoria:         form.categoria,
          descripcion:       form.descripcion,
          comercio:          form.comercio,
          tipo:              form.tipo,
          personal_familiar: form.tipo,
          cuenta_id:         form.usa_tarjeta ? '' : form.cuenta_id,
          tarjeta_id:        form.usa_tarjeta ? form.tarjeta_id : '',
        }, {
          editadoPor:      perfil?.id,
          balanceAnterior: montoAnterior,
          balanceNuevo:    montoNuevo,
        })
        setModo(MODO_GUARDADO)
        setTimeout(() => navigate('/gastos'), 1500)
        return
      }

      // 1b. MODO NUEVO — registrar gasto
      await addGasto({
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
        confianza_ia:      confianza,
      })

      // 2. Descontar de cuenta origen
      if (!form.usa_tarjeta && form.cuenta_id) {
        const cuenta = cuentas.find(c => c.id === form.cuenta_id)
        if (cuenta && cuenta.solo_consulta !== 'true') {
          const descuento = montoRDP || montoUSD || 0
          await updateBalance(form.cuenta_id, Number(cuenta.balance || 0) - descuento)
        }
      }

      // 3. Actualizar saldo tarjeta
      if (form.usa_tarjeta && form.tarjeta_id) {
        const tarjeta = tarjetas.find(t => t.id === form.tarjeta_id)
        if (tarjeta) {
          const usado = Number(tarjeta.saldo_usado || 0) + (montoRDP || montoUSD || 0)
          const data  = await getSheet('tarjetas_credito')
          const idx   = (data.rows || []).findIndex(r => r.id === form.tarjeta_id)
          if (idx !== -1) await updateRow('tarjetas_credito', idx + 2, { ...tarjeta, saldo_usado: usado.toFixed(2) })
        }
      }

      // 4. Transferencia de ahorro
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
        const cuentaDest = cuentas.find(c => c.id === form.cuenta_destino_id)
        if (cuentaDest) await updateBalance(form.cuenta_destino_id, Number(cuentaDest.balance || 0) + (montoRDP || montoUSD || 0))
      }

      // 5. Deuda interna
      if (esDeuda && form.beneficiario_id) {
        await appendRow('deudas_internas', {
          id: `di_${Date.now()}`, fecha: form.fecha,
          pagador_id: form.usuario_id, beneficiario_id: form.beneficiario_id,
          monto: montoRDP || montoUSD,
          descripcion: form.descripcion || form.comercio || form.categoria,
          saldada: 'false', fecha_saldada: '',
        })
      }

      // 6. Aprender del comercio (si vino de OCR y fue confirmado)
      if (form.comercio && sugerencia) {
        await upsertComercio(form.comercio, form.categoria)
      }

      // 7. Verificar presupuestos y enviar alertas (sin bloquear el guardado)
      try {
        const { verificarPresupuestos } = await import('../services/alertas')
        const [presData, gastosData] = await Promise.all([
          getSheet('presupuestos'),
          getGastos({ mes: form.fecha.substring(0, 7) }),
        ])
        await verificarPresupuestos(form.categoria, gastosData, presData.rows || [], usuarios)
      } catch (e) { console.warn('Alertas:', e.message) }

      setModo(MODO_GUARDADO)
      setTimeout(() => navigate('/'), 1800)

    } catch (err) {
      setError(err.message || 'Error al guardar el gasto.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  // ─── Pantalla: guardado exitoso ─────────────────────────────────────────────
  if (modo === MODO_GUARDADO) return (
    <div style={S.centerScreen}>
      <div style={{ animation: 'fadeInUp .3s ease' }}>
        <CheckCircle size={72} color="#1B5E35" />
        <h2 style={{ fontWeight: 700, color: '#1B5E35', marginTop: '.75rem' }}>¡Gasto registrado!</h2>
        <p style={{ color: '#9CA3AF', marginTop: '.25rem' }}>Volviendo al inicio...</p>
      </div>
    </div>
  )

  // ─── Pantalla: procesando OCR ───────────────────────────────────────────────
  if (modo === MODO_OCR) return (
    <div style={S.centerScreen}>
      {imagenPreview && (
        <img src={imagenPreview} alt="Factura" style={S.previewImg} />
      )}
      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto .75rem' }} />
        <p style={{ fontWeight: 600, color: 'var(--color-text,#1F2937)' }}>{ocrStatus}</p>
        <p style={{ fontSize: '.8rem', color: '#9CA3AF', marginTop: '.25rem' }}>
          Esto toma unos segundos...
        </p>
      </div>
    </div>
  )

  // ─── Pantalla: selección de modo ───────────────────────────────────────────
  if (modo === MODO_SELECCION) return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: '.25rem' }}>Nuevo gasto</h2>
      <p style={{ color: 'var(--color-text-muted,#9CA3AF)', fontSize: '.875rem', marginBottom: '1.5rem' }}>
        ¿Tienes una factura o recibo?
      </p>

      {error && <div style={S.errorBox}>{error}</div>}

      {/* Opción 1: Foto */}
      <div style={S.modeCard} onClick={() => fileInputRef.current?.click()}>
        <div style={{ ...S.modeIcon, background: '#EEF5FC' }}>
          <Camera size={28} color="#2E6DA4" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: '1rem' }}>Tomar foto de factura</p>
          <p style={{ fontSize: '.82rem', color: '#9CA3AF', marginTop: '.15rem' }}>
            La IA extrae monto, comercio y categoría automáticamente
          </p>
        </div>
        <div style={{ ...S.badge, background: '#EEF5FC', color: '#2E6DA4' }}>
          <Zap size={13} /> IA
        </div>
      </div>

      {/* Input oculto para cámara */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleImageSelect}
      />

      {/* También permite subir desde galería */}
      <div style={{ textAlign: 'center', margin: '.5rem 0', color: '#9CA3AF', fontSize: '.8rem' }}>
        o
      </div>

      <div style={S.modeCard} onClick={() => {
        // Abrir selector sin capture para elegir de galería
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = handleImageSelect
        input.click()
      }}>
        <div style={{ ...S.modeIcon, background: 'var(--color-card-hover,#F3F4F6)' }}>
          📁
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: '1rem' }}>Subir imagen de la galería</p>
          <p style={{ fontSize: '.82rem', color: '#9CA3AF', marginTop: '.15rem' }}>
            Selecciona una foto existente de tu recibo
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '.5rem 0', color: '#9CA3AF', fontSize: '.8rem' }}>
        o
      </div>

      {/* Opción 2: Manual */}
      <div style={S.modeCard} onClick={() => setModo(MODO_MANUAL)}>
        <div style={{ ...S.modeIcon, background: 'var(--color-card-hover,#F3F4F6)' }}>
          <FileText size={28} color="#4B5563" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: '1rem' }}>Ingresar manualmente</p>
          <p style={{ fontSize: '.82rem', color: '#9CA3AF', marginTop: '.15rem' }}>
            Para gastos sin factura o cuando prefieres escribirlo tú
          </p>
        </div>
      </div>
    </div>
  )

  // ─── Pantalla: confirmación de sugerencia IA ────────────────────────────────
  if (modo === MODO_CONFIRMAR) return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700 }}>Confirmar gasto</h2>
        <button onClick={() => { setModo(MODO_SELECCION); setImagenPreview(null) }} style={S.closeBtn}>
          <X size={20} />
        </button>
      </div>

      {/* Imagen y resultado IA */}
      {imagenPreview && (
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <img src={imagenPreview} alt="Factura" style={{ ...S.previewImg, maxHeight: 160 }} />
        </div>
      )}

      {/* Badge de confianza */}
      {sugerencia && (
        <div style={{
          ...S.confianzaBadge,
          background: sugerencia.confianza >= 0.75 ? '#D4EDDA' : '#FFF3CD',
          color: sugerencia.confianza >= 0.75 ? '#1B5E35' : '#7A4800',
        }}>
          {sugerencia.confianza >= 0.75
            ? <><CheckCircle size={15} /> IA detectó con alta confianza ({Math.round(sugerencia.confianza * 100)}%)</>
            : <><AlertCircle size={15} /> Confianza media ({Math.round(sugerencia.confianza * 100)}%) — por favor verifica</>
          }
        </div>
      )}

      {/* Formulario de confirmación */}
      <FormularioGasto
        form={form} setForm={setForm}
        cuentas={cuentas} usuarios={usuarios} tarjetas={tarjetas}
        esAhorro={esAhorro} esDeuda={esDeuda}
        modoEdicion={modoEdicion}
        error={error} saving={saving}
        onSubmit={handleGuardar}
        onCancel={() => { setModo(MODO_SELECCION); setImagenPreview(null) }}
        modoConfirmar={true}
      />
    </div>
  )

  // ─── Pantalla: formulario manual ─────────────────────────────────────────────
  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700 }}>{modoEdicion ? '✏️ Editar gasto' : 'Nuevo gasto manual'}</h2>
        <button onClick={() => setModo(MODO_SELECCION)} style={S.closeBtn}>
          <X size={20} />
        </button>
      </div>

      <FormularioGasto
        form={form} setForm={setForm}
        cuentas={cuentas} usuarios={usuarios} tarjetas={tarjetas}
        esAhorro={esAhorro} esDeuda={esDeuda}
        error={error} saving={saving}
        onSubmit={handleGuardar}
        onCancel={() => setModo(MODO_SELECCION)}
        modoConfirmar={false}
      />
    </div>
  )
}

// ─── Componente: formulario reutilizable ──────────────────────────────────────
function FormularioGasto({ form, setForm, cuentas, usuarios, tarjetas, esAhorro, esDeuda, error, saving, onSubmit, onCancel, modoConfirmar, modoEdicion }) {
  const [showCategorias, setShowCategorias] = useState(!modoConfirmar || !form.categoria)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const cuentasOp = cuentas.filter(c => c.solo_consulta !== 'true')

  return (
    <form onSubmit={onSubmit}>

      {/* Monto */}
      <div className="card" style={{ marginBottom: '1rem' }}>
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

      {/* Categoría */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCategorias ? '.75rem' : 0, cursor: 'pointer' }}
          onClick={() => setShowCategorias(v => !v)}>
          <div>
            <label className="label" style={{ marginBottom: 0, cursor: 'pointer' }}>Categoría</label>
            {form.categoria && !showCategorias && (
              <p style={{ fontWeight: 600, color: '#2E6DA4', marginTop: '.15rem' }}>
                {CATEGORIAS.find(c => c.label === form.categoria)?.icon} {form.categoria}
              </p>
            )}
          </div>
          {showCategorias ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
        </div>
        {showCategorias && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem' }}>
            {CATEGORIAS.map(c => (
              <button key={c.label} type="button"
                onClick={() => { setF('categoria', c.label); setShowCategorias(false) }}
                style={{
                  padding: '.6rem .3rem', borderRadius: 10, border: '1.5px solid',
                  borderColor: form.categoria === c.label ? '#2E6DA4' : '#E5E7EB',
                  background:  form.categoria === c.label ? '#EEF5FC' : 'var(--color-card,#fff)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.2rem',
                }}>
                <span style={{ fontSize: '1.2rem' }}>{c.icon}</span>
                <span style={{ fontSize: '.62rem', fontWeight: 600, lineHeight: 1.2, textAlign: 'center',
                  color: form.categoria === c.label ? '#2E6DA4' : 'var(--color-text-secondary,#4B5563)' }}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        )}
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
          <label className="label">Comercio</label>
          <input className="input" placeholder="Ej: La Sirena, Netflix..."
            value={form.comercio} onChange={e => setF('comercio', e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label">Nota (opcional)</label>
          <input className="input" placeholder="Detalles adicionales..."
            value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} />
        </div>
      </div>

      {/* Personal / Familiar */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <label className="label">Tipo de gasto</label>
        <div style={{ display: 'flex', gap: '.75rem' }}>
          {['familiar', 'personal'].map(t => (
            <button key={t} type="button" onClick={() => setF('tipo', t)} style={{
              flex: 1, padding: '.7rem', borderRadius: 10, border: '1.5px solid',
              borderColor: form.tipo === t ? '#2E6DA4' : '#E5E7EB',
              background:  form.tipo === t ? '#EEF5FC' : 'var(--color-card,#fff)',
              cursor: 'pointer', fontWeight: 600, fontSize: '.875rem',
              color: form.tipo === t ? '#2E6DA4' : 'var(--color-text-secondary,#4B5563)',
            }}>
              {t === 'familiar' ? '👨‍👩‍👧 Familiar' : '👤 Personal'}
            </button>
          ))}
        </div>
      </div>

      {/* Pago */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <label className="label">¿Cómo se pagó?</label>
        <div style={{ display: 'flex', gap: '.75rem', marginBottom: '.75rem' }}>
          <button type="button" onClick={() => setF('usa_tarjeta', false)} style={{
            flex: 1, padding: '.65rem', borderRadius: 10, border: '1.5px solid',
            borderColor: !form.usa_tarjeta ? '#2E6DA4' : '#E5E7EB',
            background:  !form.usa_tarjeta ? '#EEF5FC' : 'var(--color-card,#fff)',
            cursor: 'pointer', fontWeight: 600, fontSize: '.82rem',
            color: !form.usa_tarjeta ? '#2E6DA4' : 'var(--color-text-secondary,#4B5563)',
          }}>🏦 Cuenta / Efectivo</button>
          <button type="button" onClick={() => setF('usa_tarjeta', true)}
            disabled={tarjetas.length === 0}
            style={{
              flex: 1, padding: '.65rem', borderRadius: 10, border: '1.5px solid',
              borderColor: form.usa_tarjeta ? '#2E6DA4' : '#E5E7EB',
              background:  form.usa_tarjeta ? '#EEF5FC' : 'var(--color-card,#fff)',
              cursor: tarjetas.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '.82rem',
              color: form.usa_tarjeta ? '#2E6DA4' : 'var(--color-text-secondary,#4B5563)',
              opacity: tarjetas.length === 0 ? .5 : 1,
            }}>💳 Tarjeta crédito</button>
        </div>

        {!form.usa_tarjeta ? (
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">Cuenta</label>
            <select className="input" value={form.cuenta_id} onChange={e => setF('cuenta_id', e.target.value)}>
              <option value="">Seleccionar cuenta</option>
              {cuentasOp.map(c => (
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

      {/* Ahorro */}
      {esAhorro && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #1B5E35' }}>
          <p style={{ fontWeight: 700, color: '#1B5E35', marginBottom: '.5rem' }}>💰 Transferencia de ahorro</p>
          <p style={{ fontSize: '.82rem', color: 'var(--color-text-secondary,#4B5563)', marginBottom: '.75rem' }}>
            El dinero saldrá de la cuenta seleccionada arriba y se moverá a:
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

      {/* Deuda interna */}
      {esDeuda && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #7A4800' }}>
          <p style={{ fontWeight: 700, color: '#7A4800', marginBottom: '.5rem' }}>🤝 Deuda interna familiar</p>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">¿Quién te debe reembolsar?</label>
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

      <div style={{ display: 'flex', gap: '.75rem' }}>
        <button type="submit" className="btn btn-primary"
          disabled={saving}
          style={{ flex: 1, padding: '.9rem', fontSize: '.95rem' }}>
          {saving ? 'Guardando...' : modoEdicion ? '✓ Guardar cambios' : modoConfirmar ? '✓ Confirmar y guardar' : '✓ Registrar gasto'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}
          style={{ padding: '.9rem 1rem' }}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

const S = {
  centerScreen: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', textAlign: 'center', gap: '.5rem' },
  modeCard: {
    background: 'var(--color-card,#fff)', borderRadius: 16, padding: '1.1rem 1.25rem',
    display: 'flex', alignItems: 'center', gap: '1rem',
    boxShadow: '0 2px 8px var(--color-shadow,rgba(0,0,0,.08))', cursor: 'pointer',
    border: '1.5px solid var(--color-border,#E5E7EB)', marginBottom: '.75rem',
    transition: 'border-color .15s',
  },
  modeIcon: { width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.5rem' },
  badge: { display: 'flex', alignItems: 'center', gap: '.25rem', padding: '.25rem .6rem', borderRadius: 99, fontSize: '.75rem', fontWeight: 700, flexShrink: 0 },
  previewImg: { width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 },
  confianzaBadge: { display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.65rem 1rem', borderRadius: 10, fontSize: '.82rem', fontWeight: 600, marginBottom: '1rem' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: '.25rem' },
  errorBox: { background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: '1rem' },
}
