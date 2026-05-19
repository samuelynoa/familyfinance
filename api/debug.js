// api/debug.js — TEMPORAL: eliminar después de resolver el problema
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key   = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || ''
  const sheetsId = process.env.VITE_SHEETS_ID

  // Verificar sin exponer valores reales
  const checks = {
    // Variables presentes
    email_presente:     !!email,
    key_presente:       !!key,
    sheetsId_presente:  !!sheetsId,

    // Formato del email
    email_tiene_arroba: email?.includes('@') || false,
    email_es_service:   email?.includes('iam.gserviceaccount.com') || false,

    // Formato de la clave
    key_longitud:            key.length,
    key_tiene_begin:         key.includes('BEGIN PRIVATE KEY') || key.includes('BEGIN RSA PRIVATE KEY'),
    key_tiene_end:           key.includes('END PRIVATE KEY') || key.includes('END RSA PRIVATE KEY'),
    key_tiene_slash_n:       key.includes('\\n'),   // \n literales (correcto)
    key_tiene_newline_real:  key.includes('\n'),     // saltos de línea reales
    key_empieza_con_comilla: key.startsWith('"'),    // error común: pegar con comillas
    key_primeros_30_chars:   key.substring(0, 30).replace(/\n/g, '[LF]').replace(/\r/g, '[CR]'),

    // Sheets ID
    sheetsId_longitud: sheetsId?.length || 0,
    sheetsId_tiene_slash: sheetsId?.includes('/') || false,  // error común: pegar URL completa
  }

  // Intentar crear el auth y hacer una llamada real
  let authTest = 'no intentado'
  try {
    const { google } = require('googleapis')
    const keyFixed = key.replace(/\\n/g, '\n')
    const auth = new google.auth.JWT(email, null, keyFixed, ['https://www.googleapis.com/auth/spreadsheets'])
    await auth.authorize()
    authTest = '✓ Autenticación exitosa'
  } catch (e) {
    authTest = '✗ Error: ' + e.message
  }

  res.status(200).json({ checks, authTest })
}
