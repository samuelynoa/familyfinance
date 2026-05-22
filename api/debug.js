// api/debug.js — TEMPORAL
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const email    = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key      = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const { google } = require('googleapis')

  // Test Vision API con imagen mínima (1x1 pixel blanco en base64)
  let visionTest = 'no intentado'
  try {
    const auth  = new google.auth.JWT(email, null, key, ['https://www.googleapis.com/auth/cloud-vision'])
    const token = await auth.getAccessToken()

    const visionRes = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        }]
      }),
    })
    const data = await visionRes.json()
    if (!visionRes.ok) {
      visionTest = '✗ HTTP ' + visionRes.status + ': ' + JSON.stringify(data.error || data)
    } else {
      visionTest = '✓ Vision API OK — proyecto: ' + (data.responses?.[0] ? 'responde' : 'sin texto (normal para imagen vacía)')
    }
  } catch (e) { visionTest = '✗ ' + e.message }

  // Test Claude API
  let claudeTest = 'no intentado'
  try {
    if (!anthropicKey) {
      claudeTest = '✗ ANTHROPIC_API_KEY no configurada en Vercel'
    } else {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'di solo: ok' }],
        }),
      })
      const data = await claudeRes.json()
      if (!claudeRes.ok) {
        claudeTest = '✗ HTTP ' + claudeRes.status + ': ' + JSON.stringify(data.error || data)
      } else {
        claudeTest = '✓ Claude API OK — modelo: ' + data.model
      }
    }
  } catch (e) { claudeTest = '✗ ' + e.message }

  res.status(200).json({ visionTest, claudeTest, anthropicKey_presente: !!anthropicKey })
}
