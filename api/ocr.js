// api/ocr.js — Vercel Serverless Function (CommonJS)
// Recibe imagen en base64, la envía a Google Cloud Vision, devuelve texto extraído

const { google } = require('googleapis')

const SCOPES = ['https://www.googleapis.com/auth/cloud-vision']

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key   = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Missing service account credentials')
  return new google.auth.JWT(email, null, key, SCOPES)
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ message: 'Method not allowed' })

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body
    if (!imageBase64) return res.status(400).json({ message: 'imageBase64 requerido' })

    const auth  = getAuth()
    const token = await auth.getAccessToken()

    // Llamada directa a Vision REST API
    const visionRes = await fetch(
      'https://vision.googleapis.com/v1/images:annotate',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            image:    { content: imageBase64 },
            features: [
              { type: 'TEXT_DETECTION',     maxResults: 1 },
              { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 },
            ],
          }],
        }),
      }
    )

    if (!visionRes.ok) {
      const err = await visionRes.json()
      throw new Error(err.error?.message || `Vision API error ${visionRes.status}`)
    }

    const data        = await visionRes.json()
    const annotation  = data.responses?.[0]
    const textoCompleto = annotation?.fullTextAnnotation?.text
      || annotation?.textAnnotations?.[0]?.description
      || ''

    return res.status(200).json({
      texto:     textoCompleto,
      confianza: textoCompleto.length > 20 ? 0.9 : 0.5,
    })

  } catch (err) {
    console.error('[ocr]', err)
    return res.status(500).json({ message: err.message })
  }
}
