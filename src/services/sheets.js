const SHEETS_ID = import.meta.env.VITE_SHEETS_ID

async function sheetsRequest(method, sheet, data = null, range = null) {
  const res = await fetch('/api/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, sheet, data, range, sheetsId: SHEETS_ID }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Sheets API error ' + res.status)
  }
  return res.json()
}

export async function getSheet(sheet) {
  return sheetsRequest('GET', sheet)
}
export async function appendRow(sheet, row) {
  return sheetsRequest('APPEND', sheet, row)
}
export async function updateRow(sheet, rowIndex, row) {
  return sheetsRequest('UPDATE', sheet, row, rowIndex)
}
export async function deleteRow(sheet, rowIndex) {
  return sheetsRequest('DELETE', sheet, null, rowIndex)
}

export async function getGastos(filters = {}) {
  const data = await getSheet('gastos')
  let rows = data.rows || []
  if (filters.usuario_id) rows = rows.filter(r => r.usuario_id === filters.usuario_id)
  if (filters.categoria)  rows = rows.filter(r => r.categoria === filters.categoria)
  if (filters.mes)        rows = rows.filter(r => r.fecha && r.fecha.startsWith(filters.mes))
  if (filters.tipo)       rows = rows.filter(r => r.tipo === filters.tipo)
  return rows
}

export async function addGasto(gasto) {
  const id = 'g_' + Date.now()
  await appendRow('gastos', {
    id,
    fecha:             gasto.fecha || new Date().toISOString().split('T')[0],
    monto_rdp:         gasto.monto_rdp || '',
    monto_usd:         gasto.monto_usd || '',
    categoria:         gasto.categoria,
    subcategoria:      gasto.subcategoria || '',
    tipo:              gasto.tipo || 'familiar',
    usuario_id:        gasto.usuario_id,
    cuenta_id:         gasto.cuenta_id || '',
    tarjeta_id:        gasto.tarjeta_id || '',
    descripcion:       gasto.descripcion || '',
    comercio:          gasto.comercio || '',
    es_ahorro:         gasto.es_ahorro ? 'true' : 'false',
    cuenta_destino_id: gasto.cuenta_destino_id || '',
    prestamo_id:       gasto.prestamo_id || '',
    foto_url:          gasto.foto_url || '',
    confianza_ia:      gasto.confianza_ia || '',
    confirmado_usuario:gasto.confirmado_usuario ? 'true' : 'false',
    personal_familiar: gasto.personal_familiar || 'familiar',
  })
  return id
}

export async function getCuentas() {
  const data = await getSheet('cuentas')
  return (data.rows || []).filter(r => r.activa === 'true')
}

export async function updateBalance(cuentaId, nuevoBalance) {
  const data = await getSheet('cuentas')
  const idx  = (data.rows || []).findIndex(r => r.id === cuentaId)
  if (idx === -1) throw new Error('Cuenta ' + cuentaId + ' no encontrada')
  await updateRow('cuentas', idx + 2, { ...data.rows[idx], balance: nuevoBalance.toFixed(2) })
}

export async function addCuenta(cuenta) {
  const id = 'cta_' + Date.now()
  await appendRow('cuentas', {
    id,
    nombre:        cuenta.nombre,
    tipo:          cuenta.tipo,
    moneda:        cuenta.moneda,
    balance:       cuenta.balance || '0',
    solo_consulta: cuenta.solo_consulta ? 'true' : 'false',
    activa:        'true',
    color:         cuenta.color || '#2E6DA4',
  })
  return id
}

export async function getUsuarios() {
  const data = await getSheet('usuarios')
  return (data.rows || []).filter(r => r.activo === 'true')
}

export async function addUsuario(usuario) {
  const id = 'usr_' + Date.now()
  await appendRow('usuarios', {
    id,
    nombre:       usuario.nombre,
    email:        usuario.email,
    rol:          usuario.rol || 'miembro',
    avatar_color: usuario.avatar_color || '#2E6DA4',
    activo:       'true',
  })
  return id
}

export async function getUsuarioByEmail(email) {
  const data = await getSheet('usuarios')
  return (data.rows || []).find(r => r.email === email && r.activo === 'true') || null
}

export async function addTransferencia(t) {
  const id = 'tr_' + Date.now()
  await appendRow('transferencias', {
    id,
    fecha:             t.fecha || new Date().toISOString().split('T')[0],
    cuenta_origen_id:  t.cuenta_origen_id,
    cuenta_destino_id: t.cuenta_destino_id,
    monto:             t.monto,
    moneda:            t.moneda || 'RD$',
    tipo:              t.tipo || 'movimiento',
    descripcion:       t.descripcion || '',
    usuario_id:        t.usuario_id,
  })
  return id
}

export async function getPresupuestos() {
  const data = await getSheet('presupuestos')
  return (data.rows || []).filter(r => r.activo === 'true')
}

export async function getComercios() {
  const data = await getSheet('comercios_aprendidos')
  return data.rows || []
}

export async function upsertComercio(nombre, categoria) {
  const data = await getSheet('comercios_aprendidos')
  const rows = data.rows || []
  const idx  = rows.findIndex(r => r.nombre_comercio && r.nombre_comercio.toLowerCase() === nombre.toLowerCase())
  const hoy  = new Date().toISOString().split('T')[0]
  if (idx === -1) {
    await appendRow('comercios_aprendidos', {
      id: 'com_' + Date.now(), nombre_comercio: nombre, categoria,
      veces_confirmado: '1', ultima_vez: hoy,
    })
  } else {
    await updateRow('comercios_aprendidos', idx + 2, {
      ...rows[idx], categoria,
      veces_confirmado: String(Number(rows[idx].veces_confirmado || 0) + 1),
      ultima_vez: hoy,
    })
  }
}

export async function addIngreso(ingreso) {
  const id = 'inc_' + Date.now()
  await appendRow('ingresos', {
    id,
    fecha:       ingreso.fecha || new Date().toISOString().split('T')[0],
    monto_rdp:   ingreso.monto_rdp || '',
    monto_usd:   ingreso.monto_usd || '',
    categoria:   ingreso.categoria,
    usuario_id:  ingreso.usuario_id,
    cuenta_id:   ingreso.cuenta_id || '',
    descripcion: ingreso.descripcion || '',
    recurrente:  ingreso.recurrente ? 'true' : 'false',
  })
  return id
}

export async function getIngresos(filters = {}) {
  const data = await getSheet('ingresos')
  let rows = data.rows || []
  if (filters.mes)        rows = rows.filter(r => r.fecha && r.fecha.startsWith(filters.mes))
  if (filters.usuario_id) rows = rows.filter(r => r.usuario_id === filters.usuario_id)
  return rows
}
