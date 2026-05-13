// api/sheets.js  — Vercel Serverless Function (CommonJS)
// Runs on the server; service account credentials never reach the browser.

const { google } = require('googleapis')

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

// Sheet column definitions — order must match the Google Sheets headers
const COLUMNS = {
  gastos: [
    'id','fecha','monto_rdp','monto_usd','categoria','subcategoria','tipo',
    'usuario_id','cuenta_id','tarjeta_id','descripcion','comercio',
    'es_ahorro','cuenta_destino_id','prestamo_id','foto_url',
    'confianza_ia','confirmado_usuario','personal_familiar'
  ],
  cuentas: ['id','nombre','tipo','moneda','balance','solo_consulta','activa','color'],
  tarjetas_credito: ['id','nombre','banco','limite','saldo_usado','fecha_corte','moneda','activa'],
  prestamos: ['id','nombre','capital_original','capital_pendiente','tasa_anual','cuota_mensual','fecha_inicio','fecha_vencimiento','cuenta_id','activo'],
  usuarios: ['id','nombre','email','rol','avatar_color','activo'],
  presupuestos: ['id','categoria','monto_mensual_rdp','alerta_80','alerta_100','activo'],
  comercios_aprendidos: ['id','nombre_comercio','categoria','veces_confirmado','ultima_vez'],
  transferencias: ['id','fecha','cuenta_origen_id','cuenta_destino_id','monto','moneda','tipo','descripcion','usuario_id'],
  deudas_internas: ['id','fecha','pagador_id','beneficiario_id','monto','descripcion','saldada','fecha_saldada'],
  ingresos: ['id','fecha','monto_rdp','monto_usd','categoria','usuario_id','cuenta_id','descripcion','recurrente'],
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key   = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Missing service account credentials')
  return new google.auth.JWT(email, null, key, SCOPES)
}

function rowToObj(headers, row) {
  const obj = {}
  headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
  return obj
}

function objToRow(cols, obj) {
  return cols.map(c => obj[c] ?? '')
}

module.exports = async function handler(req, res) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ message: 'Method not allowed' })

  try {
    const { method, sheet, data, range, sheetsId } = req.body
    if (!sheetsId) return res.status(400).json({ message: 'sheetsId required' })

    const auth    = getAuth()
    const sheets  = google.sheets({ version: 'v4', auth })
    const cols    = COLUMNS[sheet]
    if (!cols) return res.status(400).json({ message: `Unknown sheet: ${sheet}` })

    // ── GET all rows ──────────────────────────────────────────────────────
    if (method === 'GET') {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsId,
        range: `${sheet}!A1:Z`,
      })
      const [header, ...rows] = resp.data.values || [[]]
      const objects = rows.filter(r => r.some(c => c)).map(r => rowToObj(header, r))
      return res.status(200).json({ rows: objects })
    }

    // ── APPEND new row ────────────────────────────────────────────────────
    if (method === 'APPEND') {
      const row = objToRow(cols, data)
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetsId,
        range: `${sheet}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      })
      return res.status(200).json({ ok: true })
    }

    // ── UPDATE row at index (1-based sheet row number) ────────────────────
    if (method === 'UPDATE') {
      const row = objToRow(cols, data)
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetsId,
        range: `${sheet}!A${range}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      })
      return res.status(200).json({ ok: true })
    }

    // ── DELETE row (clear it) ─────────────────────────────────────────────
    if (method === 'DELETE') {
      const lastCol = String.fromCharCode(64 + cols.length)
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetsId,
        range: `${sheet}!A${range}:${lastCol}${range}`,
      })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ message: `Unknown method: ${method}` })
  } catch (err) {
    console.error('[sheets api]', err)
    return res.status(500).json({ message: err.message })
  }
}
