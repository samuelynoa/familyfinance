// src/services/ocr.js
// OCR local sin APIs externas usando Tesseract.js (gratis, corre en el navegador)
// + clasificador local sin Claude

import { clasificarGasto } from './classifier'

/**
 * Comprime imagen antes de procesarla
 */
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

/**
 * Extrae texto de imagen usando Tesseract.js (OCR en el navegador, 100% gratis)
 */
async function extractTextTesseract(file, onProgress) {
  // Carga Tesseract dinámicamente (no lo instalamos como dep, lo cargamos desde CDN)
  if (!window.Tesseract) {
    onProgress?.('Cargando motor OCR...')
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
      script.onload  = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  onProgress?.('Reconociendo texto...')
  const compressed = await compressImage(file, 1400, 0.9)
  const url        = URL.createObjectURL(compressed)

  try {
    const result = await window.Tesseract.recognize(url, 'spa+eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          onProgress?.(`Reconociendo texto: ${Math.round(m.progress * 100)}%`)
        }
      },
    })
    URL.revokeObjectURL(url)
    return {
      texto:     result.data.text,
      confianza: result.data.confidence / 100,
    }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

/**
 * Pipeline completo: imagen → OCR (Tesseract) → clasificación local
 */
export async function processReceiptImage(file, comerciosAprendidos = [], onProgress) {
  // Paso 1: OCR con Tesseract.js
  onProgress?.('📷 Preparando imagen...')
  let texto = ''
  let confianzaOCR = 0.5

  try {
    const ocrResult = await extractTextTesseract(file, onProgress)
    texto       = ocrResult.texto
    confianzaOCR = ocrResult.confianza
  } catch (e) {
    // Si Tesseract falla (sin conexión para cargar CDN), continuar con texto vacío
    console.warn('Tesseract falló:', e.message)
    texto = ''
  }

  onProgress?.('🤖 Clasificando gasto...')

  // Paso 2: Clasificación local
  const clasificacion = clasificarGasto(texto || '', comerciosAprendidos)

  // Si no se extrajo texto, marcar como necesita confirmación
  if (!texto || texto.trim().length < 5) {
    clasificacion.confianza = 0.3
    clasificacion.necesitaConfirmacion = true
    clasificacion.razon = 'No se pudo extraer texto — por favor completa los datos manualmente'
  }

  return {
    ...clasificacion,
    textoOCR:    texto,
    confianzaOCR,
    necesitaConfirmacion: clasificacion.confianza < 0.75,
  }
}
