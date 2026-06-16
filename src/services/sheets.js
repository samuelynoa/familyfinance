const SHEETS_ID = import.meta.env.VITE_SHEETS_ID

async function sheetsRequest(method, sheet, data = null, range = null) {
  const res = await fetch('/api/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, sheet, data, range, sheetsId: SHEETS_ID }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message || 'Error ' + res.status + ' en ' + sheet)
  return json
}

export async function getSheet(sheet) { return sheetsRequest('GET', sheet) }
export async function appendRow(sheet, row) { return sheetsRequest('APPEND', sheet, row) }
export async function updateRow(sheet, rowIndex, row) { return sheetsRequest('UPDATE', sheet, row, rowIndex) }
export async function deleteRow(sheet, rowIndex) { return sheetsRequest('DELETE', sheet, null, rowIndex) }

// ─── Gastos ──────────────────────────────────────────────────────────────────
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
  const row = {
    id,
    fecha:              gasto.fecha || new Date().toISOString().split('T')[0],
    monto_rdp:          gasto.monto_rdp || '',
    monto_usd:          gasto.monto_usd || '',
    categoria:          gasto.categoria,
    subcategoria:       gasto.subcategoria || '',
    tipo:               gasto.tipo || 'familiar',
    usuario_id:         gasto.usuario_id,
    cuenta_id:          gasto.cuenta_id || '',
    tarjeta_id:         gasto.tarjeta_id || '',
    descripcion:        gasto.descripcion || '',
    comercio:           gasto.comercio || '',
    es_ahorro:          gasto.es_ahorro ? 'true' : 'false',
    cuenta_destino_id:  gasto.cuenta_destino_id || '',
    prestamo_id:        gasto.prestamo_id || '',
    foto_url:           gasto.foto_url || '',
    confianza_ia:       gasto.confianza_ia || '',
    confirmado_usuario: gasto.confirmado_usuario ? 'true' : 'false',
    personal_familiar:  gasto.personal_familiar || 'familiar',
  }
  await appendRow('gastos', row)
  return id
}

// ─── Cuentas ─────────────────────────────────────────────────────────────────
// Filtra por visibilidad: familiar = todos, privada = solo owner o admin
export async function getCuentas({ usuarioId = '', isAdmin = false } = {}) {
  const data = await getSheet('cuentas')
  return (data.rows || []).filter(r => {
    if (r.activa !== 'true') return false
    const vis = r.visibilidad || 'familiar'
    if (vis === 'privada') return isAdmin || r.owner_id === usuarioId
    return true
  })
}

export async function getCuentasFamiliares() {
  const data = await getSheet('cuentas')
  return (data.rows || []).filter(r => r.activa === 'true' && (r.visibilidad || 'familiar') !== 'privada')
}

export async function getCuentasPrivadas(usuarioId) {
  const data = await getSheet('cuentas')
  return (data.rows || []).filter(r =>
    r.activa === 'true' && r.visibilidad === 'privada' && r.owner_id === usuarioId
  )
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
    balance:       Number(cuenta.balance || 0).toFixed(2),
    solo_consulta: cuenta.solo_consulta ? 'true' : 'false',
    activa:        'true',
    color:         cuenta.color || '#2E6DA4',
    visibilidad:   cuenta.visibilidad || 'familiar',
    owner_id:      cuenta.owner_id || '',
  })
  return id
}

export async function updateCuenta(cuentaId, cambios) {
  const data = await getSheet('cuentas')
  const idx  = (data.rows || []).findIndex(r => r.id === cuentaId)
  if (idx === -1) throw new Error('Cuenta no encontrada')
  await updateRow('cuentas', idx + 2, { ...data.rows[idx], ...cambios })
}

// ─── Tarjetas ─────────────────────────────────────────────────────────────────
export async function getTarjetas({ usuarioId = '', isAdmin = false } = {}) {
  const data = await getSheet('tarjetas_credito')
  return (data.rows || []).filter(r => {
    if (r.activa !== 'true') return false
    const vis = r.visibilidad || 'familiar'
    if (vis === 'privada') return isAdmin || r.owner_id === usuarioId
    return true
  })
}

export async function addTarjeta(tarjeta) {
  const id = 'tc_' + Date.now()
  await appendRow('tarjetas_credito', {
    id,
    nombre:      tarjeta.nombre,
    banco:       tarjeta.banco || '',
    limite:      tarjeta.limite,
    saldo_usado: '0',
    fecha_corte: tarjeta.fecha_corte || '25',
    moneda:      tarjeta.moneda || 'RD$',
    activa:      'true',
    color:       tarjeta.color || '#1E3A5F',
    visibilidad: tarjeta.visibilidad || 'familiar',
    owner_id:    tarjeta.owner_id || '',
  })
  return id
}

export async function updateTarjeta(tarjetaId, cambios) {
  const data = await getSheet('tarjetas_credito')
  const idx  = (data.rows || []).findIndex(r => r.id === tarjetaId)
  if (idx === -1) throw new Error('Tarjeta no encontrada')
  await updateRow('tarjetas_credito', idx + 2, { ...data.rows[idx], ...cambios })
}

// ─── Préstamos ────────────────────────────────────────────────────────────────
export async function getPrestamos({ usuarioId = '', isAdmin = false } = {}) {
  const data = await getSheet('prestamos')
  return (data.rows || []).filter(r => {
    if (r.activo === 'false') return false
    const vis = r.visibilidad || 'familiar'
    if (vis === 'privada') return isAdmin || r.owner_id === usuarioId
    return true
  })
}

export async function addPrestamo(prestamo) {
  const id = 'pre_' + Date.now()
  await appendRow('prestamos', {
    id,
    nombre:            prestamo.nombre,
    capital_original:  Number(prestamo.capital_original).toFixed(2),
    capital_pendiente: Number(prestamo.capital_original).toFixed(2),
    tasa_anual:        prestamo.tasa_anual || '',
    cuota_mensual:     prestamo.cuota_mensual,
    fecha_inicio:      prestamo.fecha_inicio || '',
    fecha_vencimiento: prestamo.fecha_vencimiento || '',
    cuenta_id:         prestamo.cuenta_id || '',
    activo:            'true',
    visibilidad:       prestamo.visibilidad || 'familiar',
    owner_id:          prestamo.owner_id || '',
  })
  return id
}

export async function updatePrestamo(prestamoId, cambios) {
  const data = await getSheet('prestamos')
  const idx  = (data.rows || []).findIndex(r => r.id === prestamoId)
  if (idx === -1) throw new Error('Préstamo no encontrado')
  await updateRow('prestamos', idx + 2, { ...data.rows[idx], ...cambios })
}

// ─── Presupuestos ─────────────────────────────────────────────────────────────
export async function getPresupuestos({ usuarioId = '', isAdmin = false } = {}) {
  const data = await getSheet('presupuestos')
  return (data.rows || []).filter(r => {
    if (r.activo === 'false') return false
    const vis = r.visibilidad || 'familiar'
    if (vis === 'privada') return isAdmin || r.owner_id === usuarioId
    return true
  })
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────
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

// ─── Transferencias ───────────────────────────────────────────────────────────
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

// ─── Ingresos ─────────────────────────────────────────────────────────────────
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
    visibilidad: ingreso.visibilidad || 'privada',
    owner_id:    ingreso.owner_id || '',
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

// ─── Comercios aprendidos ─────────────────────────────────────────────────────
export async function getComercios() {
  const data = await getSheet('comercios_aprendidos')
  return data.rows || []
}

export async function upsertComercio(nombre, categoria) {
  const data = await getSheet('comercios_aprendidos')
  const rows = data.rows || []
  const idx  = rows.findIndex(r => (r.nombre_comercio || '').toLowerCase() === nombre.toLowerCase())
  const hoy  = new Date().toISOString().split('T')[0]
  if (idx === -1) {
    await appendRow('comercios_aprendidos', {
      id: 'com_' + Date.now(), nombre_comercio: nombre,
      categoria, veces_confirmado: '1', ultima_vez: hoy,
    })
  } else {
    await updateRow('comercios_aprendidos', idx + 2, {
      ...rows[idx], categoria,
      veces_confirmado: String(Number(rows[idx].veces_confirmado || 0) + 1),
      ultima_vez: hoy,
    })
  }
}
/**
 * Actualiza un gasto existente. Registra auditoría de edición.
 * Ajusta balances si cambia el monto o la cuenta.
 */
export async function updateGasto(gastoId, nuevosDatos, { editadoPor = '', balanceAnterior = null, balanceNuevo = null } = {}) {
  const data = await getSheet('gastos')
  const rows = data.rows || []
  const idx  = rows.findIndex(r => r.id === gastoId)
  if (idx === -1) throw new Error('Gasto no encontrado')

  const gastoActual = rows[idx]
  const ahora       = new Date().toISOString()

  await updateRow('gastos', idx + 2, {
    ...gastoActual,
    ...nuevosDatos,
    // Auditoría
    editado_por: editadoPor,
    editado_en:  ahora,
    // No borrar campos de eliminación si existen
    eliminado_soft: gastoActual.eliminado_soft || 'false',
  })

  // Ajustar balance de cuenta si cambió el monto
  if (balanceAnterior !== null && balanceNuevo !== null) {
    const cuentaId = nuevosDatos.cuenta_id || gastoActual.cuenta_id
    if (cuentaId) {
      const cuentaData = await getSheet('cuentas')
      const cIdx = (cuentaData.rows || []).findIndex(r => r.id === cuentaId)
      if (cIdx !== -1) {
        const balActual = Number(cuentaData.rows[cIdx].balance || 0)
        // Revertir monto anterior y aplicar nuevo
        const diff = Number(balanceAnterior) - Number(balanceNuevo)
        await updateRow('cuentas', cIdx + 2, {
          ...cuentaData.rows[cIdx],
          balance: (balActual + diff).toFixed(2),
        })
      }
    }
  }

  return true
}

/**
 * Soft-delete de un gasto. Marca como eliminado sin borrar la fila.
 * Revierte el balance de la cuenta/tarjeta.
 */
export async function deleteGasto(gastoId, { eliminadoPor = '' } = {}) {
  const data = await getSheet('gastos')
  const rows = data.rows || []
  const idx  = rows.findIndex(r => r.id === gastoId)
  if (idx === -1) throw new Error('Gasto no encontrado')

  const gasto = rows[idx]
  const ahora = new Date().toISOString()
  const monto = Number(gasto.monto_rdp || gasto.monto_usd || 0)

  // Marcar como eliminado
  await updateRow('gastos', idx + 2, {
    ...gasto,
    eliminado_soft: 'true',
    eliminado_por:  eliminadoPor,
    eliminado_en:   ahora,
  })

  // Revertir balance de cuenta (si aplica)
  if (gasto.cuenta_id) {
    const cuentaData = await getSheet('cuentas')
    const cIdx = (cuentaData.rows || []).findIndex(r => r.id === gasto.cuenta_id)
    if (cIdx !== -1 && cuentaData.rows[cIdx].solo_consulta !== 'true') {
      const balActual = Number(cuentaData.rows[cIdx].balance || 0)
      await updateRow('cuentas', cIdx + 2, {
        ...cuentaData.rows[cIdx],
        balance: (balActual + monto).toFixed(2), // devolver el dinero
      })
    }
  }

  // Revertir saldo de tarjeta (si aplica)
  if (gasto.tarjeta_id) {
    const tarjData = await getSheet('tarjetas_credito')
    const tIdx = (tarjData.rows || []).findIndex(r => r.id === gasto.tarjeta_id)
    if (tIdx !== -1) {
      const saldoActual = Number(tarjData.rows[tIdx].saldo_usado || 0)
      await updateRow('tarjetas_credito', tIdx + 2, {
        ...tarjData.rows[tIdx],
        saldo_usado: Math.max(0, saldoActual - monto).toFixed(2),
      })
    }
  }

  return gasto // devolver el gasto para poder restaurarlo (undo)
}

/**
 * Restaura un gasto eliminado (undo). Revierte el soft-delete y los balances.
 */
export async function restoreGasto(gastoId) {
  const data = await getSheet('gastos')
  const rows = data.rows || []
  const idx  = rows.findIndex(r => r.id === gastoId)
  if (idx === -1) throw new Error('Gasto no encontrado')

  const gasto = rows[idx]
  const monto = Number(gasto.monto_rdp || gasto.monto_usd || 0)

  // Desmarcar eliminación
  await updateRow('gastos', idx + 2, {
    ...gasto,
    eliminado_soft: 'false',
    eliminado_por:  '',
    eliminado_en:   '',
  })

  // Revertir balance de cuenta
  if (gasto.cuenta_id) {
    const cuentaData = await getSheet('cuentas')
    const cIdx = (cuentaData.rows || []).findIndex(r => r.id === gasto.cuenta_id)
    if (cIdx !== -1 && cuentaData.rows[cIdx].solo_consulta !== 'true') {
      const balActual = Number(cuentaData.rows[cIdx].balance || 0)
      await updateRow('cuentas', cIdx + 2, {
        ...cuentaData.rows[cIdx],
        balance: (balActual - monto).toFixed(2),
      })
    }
  }

  // Revertir saldo de tarjeta
  if (gasto.tarjeta_id) {
    const tarjData = await getSheet('tarjetas_credito')
    const tIdx = (tarjData.rows || []).findIndex(r => r.id === gasto.tarjeta_id)
    if (tIdx !== -1) {
      const saldoActual = Number(tarjData.rows[tIdx].saldo_usado || 0)
      await updateRow('tarjetas_credito', tIdx + 2, {
        ...tarjData.rows[tIdx],
        saldo_usado: (saldoActual + monto).toFixed(2),
      })
    }
  }

  return true
}

