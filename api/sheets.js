// api/sheets.js — Vercel Serverless Function (CommonJS)
// Lee headers dinámicamente del Sheets para evitar problemas de orden de columnas
const { google } = require('googleapis')
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

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

// Convierte objeto a fila usando los headers REALES del Sheets (no el orden hardcoded)
function objToRowDynamic(headers, obj) {
  return headers.map(h => obj[h] ?? '')
}

async function getHeaders(sheets, sheetsId, sheet) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: sheet + '!1:1',
  })
  return (resp.data.values?.[0] || []).map(h => h.trim())
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ message: 'Method not allowed' })

  try {
    const { method, sheet, data, range, sheetsId } = req.body
    if (!sheetsId) return res.status(400).json({ message: 'sheetsId required' })

    const auth   = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // ── GET ──────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsId,
        range: sheet + '!A1:Z',
      })
      const [header, ...rows] = resp.data.values || [[]]
      const objects = rows.filter(r => r.some(c => c)).map(r => rowToObj(header, r))
      return res.status(200).json({ rows: objects })
    }

    // ── APPEND ───────────────────────────────────────────────────────────────
    if (method === 'APPEND') {
      const headers = await getHeaders(sheets, sheetsId, sheet)
      if (headers.length === 0) {
        return res.status(400).json({ message: 'Hoja ' + sheet + ' sin encabezados' })
      }
      const row = objToRowDynamic(headers, data)
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetsId,
        range: sheet + '!A1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      })
      return res.status(200).json({ ok: true })
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    if (method === 'UPDATE') {
      const headers = await getHeaders(sheets, sheetsId, sheet)
      if (headers.length === 0) {
        return res.status(400).json({ message: 'Hoja ' + sheet + ' sin encabezados' })
      }
      const row = objToRowDynamic(headers, data)
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetsId,
        range: sheet + '!A' + range,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      })
      return res.status(200).json({ ok: true })
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      const headers = await getHeaders(sheets, sheetsId, sheet)
      const lastCol = String.fromCharCode(64 + Math.max(headers.length, 1))
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetsId,
        range: sheet + '!A' + range + ':' + lastCol + range,
      })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ message: 'Unknown method: ' + method })

  } catch (err) {
    console.error('[sheets api]', err.message)
    return res.status(500).json({ message: err.message })
  }
}
