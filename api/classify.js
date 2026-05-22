// api/classify.js — Vercel Serverless Function (CommonJS)
// Recibe texto OCR + comercios aprendidos, devuelve categoría, monto, comercio, fecha

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ message: 'Method not allowed' })

  try {
    const { textoOCR, comerciosAprendidos = [] } = req.body
    if (!textoOCR) return res.status(400).json({ message: 'textoOCR requerido' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ message: 'ANTHROPIC_API_KEY no configurada' })

    // Construir contexto de comercios aprendidos
    const contextoComercios = comerciosAprendidos.length > 0
      ? `\nComercios que ya conoces y sus categorías asignadas por el usuario:\n${
          comerciosAprendidos
            .slice(0, 30) // máximo 30 para no saturar el prompt
            .map(c => `- "${c.nombre_comercio}" → ${c.categoria} (confirmado ${c.veces_confirmado} veces)`)
            .join('\n')
        }\n`
      : ''

    const prompt = `Eres un asistente de finanzas personales para una familia dominicana. 
Analiza el siguiente texto extraído de una factura o recibo y extrae la información financiera.

${contextoComercios}

CATEGORÍAS DISPONIBLES (usa exactamente estos nombres):
Supermercado, Combustible, Educación, Salud, Entretenimiento, Servicios (agua/luz/internet), Comidas Fuera de Casa, Suscripciones, Mesada Familiar, Préstamos, Ahorros, Salidas, Ropa, Hogar, Vacaciones, Mantenimiento Vehículo, Deuda interna familiar

TEXTO DEL RECIBO:
${textoOCR}

Responde ÚNICAMENTE con un objeto JSON válido, sin explicaciones ni texto adicional:
{
  "monto": número (el total a pagar, sin símbolos),
  "moneda": "RD$" o "USD",
  "comercio": "nombre del comercio o establecimiento",
  "fecha": "YYYY-MM-DD o null si no se encuentra",
  "categoria": "una de las categorías de la lista",
  "confianza": número entre 0 y 1 (qué tan seguro estás),
  "items": ["item1", "item2"] (máximo 3 items principales, opcional),
  "razon": "explicación breve de por qué elegiste esa categoría"
}`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001', // rápido y económico para clasificación
        max_tokens: 512,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.json()
      throw new Error(err.error?.message || `Claude API error ${claudeRes.status}`)
    }

    const claudeData = await claudeRes.json()
    const texto      = claudeData.content?.[0]?.text || ''

    // Parsear JSON de la respuesta
    const jsonMatch = texto.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Claude no devolvió JSON válido')

    const resultado = JSON.parse(jsonMatch[0])

    // Validar campos mínimos
    if (!resultado.categoria) throw new Error('No se pudo determinar la categoría')
    if (!resultado.monto)     resultado.monto = null

    return res.status(200).json(resultado)

  } catch (err) {
    console.error('[classify]', err)
    return res.status(500).json({ message: err.message })
  }
}
