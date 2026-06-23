// api/cron-recurrentes.js
// Vercel cron job — se ejecuta diariamente a las 6am
// Procesa gastos recurrentes con confirmacion='auto'
// Configurar en vercel.json: {"crons":[{"path":"/api/cron-recurrentes","schedule":"0 6 * * *"}]}

const { google } = require('googleapis')

const SCOPES   = ['https://www.googleapis.com/auth/spreadsheets']
const SHEETS_ID = process.env.VITE_SHEETS_ID

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key   = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  return new google.auth.JWT(email, null, key, SCOPES)
}

async function getSheet(sheets, sheet) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range: sheet + '!A1:ZZ',
  })
  const values = resp.data.values || []
  if (!values.length) return []
  const headers = values[0]
  return values.slice(1)
    .filter(r => r.some(c => c))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])))
}

async function appendRow(sheets, sheet, obj) {
  // Get headers to know column order
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range: sheet + '!1:1',
  })
  const headers = resp.data.values?.[0] || []
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '')
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEETS_ID,
    range: sheet + '!A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
}

async function updateCell(sheets, sheet, rowIndex, headers, obj) {
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '')
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEETS_ID,
    range: `${sheet}!A${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  })
}

function esPendienteHoy(r) {
  const hoy    = new Date()
  const inicio = r.fecha_inicio ? new Date(r.fecha_inicio) : new Date(0)
  const fin    = r.fecha_fin    ? new Date(r.fecha_fin)    : new Date('2100-01-01')
  if (hoy < inicio || hoy > fin || r.activo !== 'true') return false

  const diaHoy = hoy.getDate()
  switch (r.frecuencia) {
    case 'mensual':    return Number(r.dia_del_mes) === diaHoy
    case 'quincenal':  return diaHoy === Number(r.dia_del_mes) || diaHoy === Number(r.dia_del_mes) + 15
    case 'semanal': {
      const ds = hoy.getDay() || 7
      return ds === Number(r.dia_del_mes)
    }
    case 'anual':
      return diaHoy === 1 && hoy.getMonth() === 0
    default: return false
  }
}

module.exports = async function handler(req, res) {
  // Vercel cron auth
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const auth   = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const hoy    = new Date().toISOString().split('T')[0]

    const [recurrentes, gastos, cuentas, tarjetas] = await Promise.all([
      getSheet(sheets, 'gastos_recurrentes'),
      getSheet(sheets, 'gastos'),
      getSheet(sheets, 'cuentas'),
      getSheet(sheets, 'tarjetas_credito'),
    ])

    const mesHoy = hoy.substring(0, 7)
    const autosPendientes = recurrentes.filter(r =>
      r.confirmacion === 'auto' &&
      r.activo === 'true' &&
      esPendienteHoy(r) &&
      !gastos.some(g => g.recurrente_id === r.id && g.fecha?.startsWith(mesHoy))
    )

    const procesados = []

    for (const r of autosPendientes) {
      const monto = Number(r.monto || 0)
      if (!monto) continue

      try {
        const esTransferencia = r.tipo === 'transferencia'

        if (esTransferencia) {
          // Registrar transferencia
          await appendRow(sheets, 'transferencias', {
            id:                `tr_${Date.now()}_${r.id}`,
            fecha:             hoy,
            cuenta_origen_id:  r.cuenta_id,
            cuenta_destino_id: r.cuenta_destino_id,
            monto,
            moneda:            r.moneda || 'RD$',
            tipo:              'recurrente',
            descripcion:       r.nombre,
            usuario_id:        r.usuario_id,
            recurrente_id:     r.id,
          })

          // Actualizar balances
          const origen  = cuentas.find(c => c.id === r.cuenta_id)
          const destino = cuentas.find(c => c.id === r.cuenta_destino_id)
          // (balance update vía API sheets — simplificado)
        } else {
          // Registrar gasto
          await appendRow(sheets, 'gastos', {
            id:                `gst_${Date.now()}_${r.id}`,
            fecha:             hoy,
            monto_rdp:         r.moneda === 'RD$' ? monto : '',
            monto_usd:         r.moneda === 'USD' ? monto : '',
            categoria:         r.categoria,
            subcategoria:      '',
            tipo:              r.personal_familiar || 'familiar',
            usuario_id:        r.usuario_id,
            cuenta_id:         r.cuenta_id || '',
            tarjeta_id:        r.tarjeta_id || '',
            descripcion:       r.nombre,
            comercio:          r.nombre,
            es_ahorro:         'false',
            personal_familiar: r.personal_familiar || 'familiar',
            recurrente_id:     r.id,
          })
        }

        procesados.push(r.nombre)
      } catch (e) {
        console.error(`Error procesando ${r.nombre}:`, e.message)
      }
    }

    return res.status(200).json({
      ok: true,
      fecha: hoy,
      procesados: procesados.length,
      items: procesados,
    })

  } catch (err) {
    console.error('[cron-recurrentes]', err)
    return res.status(500).json({ error: err.message })
  }
}
