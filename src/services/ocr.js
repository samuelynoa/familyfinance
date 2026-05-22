// src/services/ocr.js
// Maneja captura de imagen, llamada a OCR y clasificación IA

/**
 * Convierte un File/Blob a base64
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1]) // solo la parte base64
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Comprime una imagen antes de enviarla a Vision API
 * Reduce costos y mejora velocidad
 */
export function compressImage(file, maxWidth = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx    = canvas.getContext('2d')
    const img    = new Image()
    const url    = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width  = maxWidth
      }
      canvas.width  = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', quality)
    }
    img.src = url
  })
}

/**
 * Envía imagen a Google Vision via /api/ocr
 * Devuelve { texto, confianza }
 */
export async function extractTextFromImage(file) {
  const compressed   = await compressImage(file)
  const base64       = await fileToBase64(compressed)

  const res = await fetch('/api/ocr', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Error en OCR')
  return data // { texto, confianza }
}

/**
 * Envía texto OCR a Claude via /api/classify
 * Devuelve { monto, moneda, comercio, fecha, categoria, confianza, items, razon }
 */
export async function classifyExpense(textoOCR, comerciosAprendidos = []) {
  const res = await fetch('/api/classify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ textoOCR, comerciosAprendidos }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Error en clasificación')
  return data
}

/**
 * Pipeline completo: imagen → texto → clasificación
 * Devuelve resultado enriquecido con confianza combinada
 */
export async function processReceiptImage(file, comerciosAprendidos = []) {
  // Paso 1: OCR
  const { texto, confianza: confianzaOCR } = await extractTextFromImage(file)
  if (!texto || texto.trim().length < 5) {
    throw new Error('No se pudo extraer texto de la imagen. Intenta con mejor iluminación.')
  }

  // Paso 2: Clasificación IA
  const clasificacion = await classifyExpense(texto, comerciosAprendidos)

  // Confianza combinada: promedio ponderado de OCR y IA
  const confianzaFinal = (confianzaOCR * 0.3 + (clasificacion.confianza || 0.5) * 0.7)

  return {
    ...clasificacion,
    textoOCR:      texto,
    confianzaOCR,
    confianza:     Math.round(confianzaFinal * 100) / 100,
    necesitaConfirmacion: confianzaFinal < 0.75,
  }
}
