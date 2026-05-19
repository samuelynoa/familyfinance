// api/debug.js — TEMPORAL
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const email    = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key      = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || ''
  const sheetsId = process.env.VITE_SHEETS_ID
  const keyFixed = key.replace(/\\n/g, '\n')
  const { google } = require('googleapis')

  const checks = {
    email_presente:    !!email,
    key_presente:      !!key,
    sheetsId_presente: !!sheetsId,
    sheetsId_valor:    sheetsId,
    sheetsId_longitud: sheetsId?.length || 0,
  }

  let authTest = 'no intentado'
  try {
    const auth = new google.auth.JWT(email, null, keyFixed, ['https://www.googleapis.com/auth/spreadsheets'])
    await auth.authorize()
    authTest = '✓ OK'
  } catch (e) { authTest = '✗ ' + e.message }

  let sheetsTest = 'no intentado'
  try {
    const auth = new google.auth.JWT(email, null, keyFixed, ['https://www.googleapis.com/auth/spreadsheets'])
    const sheets = google.sheets({ version: 'v4', auth })
    const resp = await sheets.spreadsheets.get({ spreadsheetId: sheetsId })
    const hojas = resp.data.sheets.map(s => s.properties.title)
    sheetsTest = '✓ OK — Hojas: ' + hojas.join(', ')
  } catch (e) { sheetsTest = '✗ ' + e.message }

  let appendTest = 'no intentado'
  try {
    const auth = new google.auth.JWT(email, null, keyFixed, ['https://www.googleapis.com/auth/spreadsheets'])
    const sheets = google.sheets({ version: 'v4', auth })
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetsId,
      range: 'cuentas!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [['TEST_ID','TEST_NOMBRE','corriente','RD$','0','false','false','#2E6DA4']] },
    })
    appendTest = '✓ OK — fila de prueba escrita en cuentas'
  } catch (e) { appendTest = '✗ ' + e.message }

  res.status(200).json({ checks, authTest, sheetsTest, appendTest })
}
