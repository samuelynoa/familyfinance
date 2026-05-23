// src/services/classifier.js
// Clasificador local sin API — reglas + comercios aprendidos

const REGLAS = [
  { categoria: 'Supermercado', palabras: ['sirena','jumbo','nacional','supermercado','super mercado','colmado','bravo','iberia','playero','supermax','carrefour','costco','walmart','grocery','market','bodega','almacen','provisiones','viveres'] },
  { categoria: 'Combustible', palabras: ['gasolina','gas station','bomba','combustible','diesel','gasolinera','texaco','shell','esso','puma','gulf','chevron','petrol','galon','litro','fuel'] },
  { categoria: 'Comidas Fuera de Casa', palabras: ['restaurant','restaurante','pizza','burger','pollo','chicken','cafe','cafeteria','dominos','mcdonalds','kfc','subway','wendys','taco','sushi','comida','lunch','dinner','desayuno','almuerzo','cena','delivery','rappi','pizza hut','burger king','fritura','empanada','chimi'] },
  { categoria: 'Salud', palabras: ['farmacia','pharmacy','doctor','medico','clinica','hospital','laboratorio','dental','dentista','medicamento','medicina','pastilla','consulta','carol morgan','homs','semma','senasa','pharma','drogueria'] },
  { categoria: 'Educación', palabras: ['colegio','escuela','universidad','instituto','academia','libreria','utiles','matricula','mensualidad escolar','pucmm','unphu','uasd','intec','unibe','apec','utesa','curso','taller','seminario','capacitacion'] },
  { categoria: 'Servicios (agua/luz/internet)', palabras: ['claro','altice','wind','tricom','viva','orange','digicel','edesur','edenorte','edeeste','caasd','coraasan','inapa','internet','cable','telefono','celular','recarga'] },
  { categoria: 'Suscripciones', palabras: ['netflix','spotify','amazon','apple','google play','youtube','disney','hbo','paramount','crunchyroll','adobe','microsoft','dropbox','icloud','chatgpt','openai','canva','zoom','suscripcion','subscription','membresia'] },
  { categoria: 'Hogar', palabras: ['ferreteria','home depot','cemento','pintura','mueble','decoracion','electrodomestico','nevera','lavadora','estufa','aire acondicionado','abanico','alquiler','renta','hipoteca','condominio'] },
  { categoria: 'Ropa', palabras: ['ropa','boutique','zara','forever21','nike','adidas','zapato','calzado','camiseta','pantalon','vestido','blusa','camisa','jean','tela'] },
  { categoria: 'Entretenimiento', palabras: ['cine','cinema','movie','teatro','concierto','evento','ticket','boleto','entrada','parque','diversion','juego','bowling','karting','escape room'] },
  { categoria: 'Salidas', palabras: ['discoteca','licor','bebida','cerveza','whisky','cocktail','copa','shots','karaoke','lounge','rooftop','terraza'] },
  { categoria: 'Mantenimiento Vehículo', palabras: ['taller','mecanico','aceite','cambio de aceite','freno','llanta','goma','bateria','car wash','lavado','peaje','toll','seguro auto'] },
  { categoria: 'Vacaciones', palabras: ['hotel','resort','hostal','airbnb','booking','expedia','vuelo','aerolinea','aeropuerto','turismo','tour','excursion','viaje'] },
]

function extraerMonto(texto) {
  let mayorValor = 0

  // Buscar patrones con etiqueta primero (total, monto, importe, a pagar)
  const etiquetas = [
    /total\s*:?\s*(?:rd\$|rds|us\$|\$)?\s*([\d,]+\.?\d{0,2})/gi,
    /monto\s*:?\s*(?:rd\$|rds|us\$|\$)?\s*([\d,]+\.?\d{0,2})/gi,
    /importe\s*:?\s*(?:rd\$|rds|us\$|\$)?\s*([\d,]+\.?\d{0,2})/gi,
    /a\s*pagar\s*:?\s*(?:rd\$|rds|us\$|\$)?\s*([\d,]+\.?\d{0,2})/gi,
    /subtotal\s*:?\s*(?:rd\$|rds|us\$|\$)?\s*([\d,]+\.?\d{0,2})/gi,
    /(?:rd\$|rds|us\$|\$)\s*([\d,]+\.?\d{0,2})/gi,
  ]

  for (const regex of etiquetas) {
    let m
    // Usar exec en loop — más compatible que matchAll
    while ((m = regex.exec(texto)) !== null) {
      const valor = parseFloat((m[1] || '').replace(/,/g, ''))
      if (!isNaN(valor) && valor > 0 && valor > mayorValor) {
        mayorValor = valor
      }
    }
  }

  // Si no encontró nada con símbolo, buscar cualquier número decimal > 50
  if (mayorValor === 0) {
    const numeros = /\b(\d{1,6}[.,]\d{2})\b/g
    let m
    while ((m = numeros.exec(texto)) !== null) {
      const valor = parseFloat(m[1].replace(',', '.'))
      if (!isNaN(valor) && valor > 50 && valor > mayorValor) {
        mayorValor = valor
      }
    }
  }

  return mayorValor > 0 ? { monto: mayorValor } : null
}

function extraerFecha(texto) {
  const meses = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12 }

  // DD/MM/YYYY o DD-MM-YYYY
  let m = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) {
    const d = parseInt(m[1]), mo = parseInt(m[2]), y = parseInt(m[3])
    if (y > 2020 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)
      return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  // YYYY-MM-DD
  m = texto.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (m) {
    const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3])
    if (y > 2020 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)
      return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  // DD de MES de YYYY
  m = texto.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/i)
  if (m) {
    const d = parseInt(m[1]), mo = meses[m[2].toLowerCase()], y = parseInt(m[3])
    if (y > 2020)
      return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  return new Date().toISOString().split('T')[0]
}

function extraerComercio(texto) {
  const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 2)
  for (const linea of lineas.slice(0, 5)) {
    if (linea.length < 3 || linea.length > 50) continue
    if (/^\d/.test(linea)) continue
    if (/^(ruc|rnc|nit|fecha|hora|factura|recibo|ticket|caja|cajero)/i.test(linea)) continue
    return linea.replace(/[^\w\s\-\.áéíóúüñÁÉÍÓÚÜÑ]/g, '').trim()
  }
  return ''
}

function detectarMoneda(texto) {
  if (/us\$|usd|dolar|dollar/i.test(texto)) return 'USD'
  return 'RD$'
}

export function clasificarGasto(textoOCR, comerciosAprendidos = []) {
  const textoLower = (textoOCR || '').toLowerCase()
  const comercio   = extraerComercio(textoOCR || '')

  // 1. Comercios aprendidos (mayor prioridad)
  if (comercio && comerciosAprendidos.length > 0) {
    const aprendido = comerciosAprendidos.find(c => {
      const nombre = (c.nombre_comercio || '').toLowerCase()
      return nombre.length > 3 && (textoLower.includes(nombre) || comercio.toLowerCase().includes(nombre))
    })
    if (aprendido && Number(aprendido.veces_confirmado) >= 1) {
      const montoData = extraerMonto(textoOCR || '')
      return {
        categoria:           aprendido.categoria,
        confianza:           Math.min(0.95, 0.75 + Number(aprendido.veces_confirmado) * 0.05),
        monto:               montoData?.monto || null,
        moneda:              detectarMoneda(textoOCR || ''),
        comercio,
        fecha:               extraerFecha(textoOCR || ''),
        fuente:              'aprendido',
        razon:               `"${aprendido.nombre_comercio}" aprendido ${aprendido.veces_confirmado} veces`,
        necesitaConfirmacion: false,
      }
    }
  }

  // 2. Reglas por palabras clave
  let mejorCategoria = null
  let mejorPuntaje   = 0
  let mejorRazon     = ''

  for (const regla of REGLAS) {
    let puntaje = 0
    const encontradas = []
    for (const palabra of regla.palabras) {
      if (textoLower.includes(palabra)) { puntaje++; encontradas.push(palabra) }
    }
    if (puntaje > mejorPuntaje) {
      mejorPuntaje   = puntaje
      mejorCategoria = regla.categoria
      mejorRazon     = 'Palabras: ' + encontradas.slice(0, 3).join(', ')
    }
  }

  const montoData = extraerMonto(textoOCR || '')
  const confianza = mejorCategoria ? Math.min(0.90, 0.50 + mejorPuntaje * 0.12) : 0.20

  return {
    categoria:           mejorCategoria || 'Hogar',
    confianza,
    monto:               montoData?.monto || null,
    moneda:              detectarMoneda(textoOCR || ''),
    comercio,
    fecha:               extraerFecha(textoOCR || ''),
    fuente:              'reglas',
    razon:               mejorRazon || 'Sin palabras clave claras',
    necesitaConfirmacion: confianza < 0.75,
  }
}

export function clasificarPorComercio(nombreComercio, comerciosAprendidos = []) {
  return clasificarGasto(nombreComercio, comerciosAprendidos)
}
