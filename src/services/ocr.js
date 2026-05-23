// src/services/ocr.js
// OCR via Google Vision API (servidor) + clasificador local

import { clasificarGasto } from './classifier'

export function compressImage(file, maxWidth = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx    = canvas.getContext('2d')
    const img    = new Image()
    const url    = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth }
      canvas.width = width; canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', quality)
    }
    img.src = url
  })
}

function fileToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function extractTextVision(file, onProgress) {
  onProgress?.('📷 Comprimiendo imagen...')
  const compressed = await compressImage(file)
  const base64     = await fileToBase64(compressed)

  onProgress?.('🔍 Leyendo texto de la factura...')
  const res = await fetch('/api/ocr', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Error en OCR')
  return data
}

export async function processReceiptImage(file, comerciosAprendidos = [], onProgress) {
  let texto = ''
  let confianzaOCR = 0.5

  try {
    const result = await extractTextVision(file, onProgress)
    texto        = result.texto || ''
    confianzaOCR = result.confianza || 0.5
  } catch (e) {
    console.warn('Vision OCR falló:', e.message)
    onProgress?.('⚠️ No se pudo leer el texto — completa manualmente')
  }

  onProgress?.('🤖 Clasificando gasto...')
  const clasificacion = clasificarGasto(texto, comerciosAprendidos)

  if (!texto || texto.trim().length < 5) {
    clasificacion.confianza          = 0.3
    clasificacion.necesitaConfirmacion = true
    clasificacion.razon              = 'No se extrajo texto — completa los datos manualmente'
  }

  return {
    ...clasificacion,
    textoOCR:            texto,
    confianzaOCR,
    necesitaConfirmacion: clasificacion.confianza < 0.75,
  }
}
