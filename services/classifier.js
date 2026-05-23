// src/services/classifier.js
// Clasificador local sin API — usa reglas + comercios aprendidos
// Funciona 100% offline, sin costo

// ─── Reglas por palabras clave ────────────────────────────────────────────────
const REGLAS = [
  {
    categoria: 'Supermercado',
    palabras: [
      'sirena','jumbo','nacional','supermercado','super mercado','colmado',
      'bravo','iberia','playero','supermax','carrefour','costco','walmart',
      'grocery','market','bodega','almacen','provisiones','víveres','viveres',
    ],
  },
  {
    categoria: 'Combustible',
    palabras: [
      'gasolina','gas station','bomba','combustible','diesel','gasolinera',
      'texaco','shell','esso','puma','total','gulf','chevron','petrol',
      'galón','galon','litro','fuel',
    ],
  },
  {
    categoria: 'Comidas Fuera de Casa',
    palabras: [
      'restaurant','restaurante','pizza','burger','pollo','chicken','cafe',
      'cafetería','cafeteria','dominos','mcdonalds','kfc','subway','wendys',
      'taco','sushi','comida','lunch','dinner','desayuno','almuerzo','cena',
      'bar ','menu','orden','delivery','grubhub','rappi','uber eat',
      'pizza hut','burger king','fritura','empanada','chimi',
    ],
  },
  {
    categoria: 'Salud',
    palabras: [
      'farmacia','pharmacy','doctor','médico','medico','clinica','clínica',
      'hospital','laboratorio','lab ','dental','dentista','odontologo',
      'medicamento','medicina','pastilla','consulta','cita médica',
      'carol morgan','homs','general de la plaza','semma','senasa',
      'pharma','drogueria','droguería',
    ],
  },
  {
    categoria: 'Educación',
    palabras: [
      'colegio','escuela','universidad','instituto','academia','librería',
      'libreria','útiles','utiles','matricula','matrícula','mensualidad escolar',
      'pucmm','unphu','uasd','intec','unibe','apec','utesa',
      'curso','taller','seminario','capacitación','capacitacion',
    ],
  },
  {
    categoria: 'Servicios (agua/luz/internet)',
    palabras: [
      'claro','altice','wind','tricom','viva','orange','digicel',
      'edesur','edenorte','edeeste','caasd','coraasan','inapa',
      'luz ','agua ','internet','cable','telefono','teléfono',
      'celular','recarga','factura de','servicio de',
    ],
  },
  {
    categoria: 'Suscripciones',
    palabras: [
      'netflix','spotify','amazon','apple','google play','youtube',
      'disney','hbo','paramount','crunchyroll','adobe','microsoft',
      'dropbox','icloud','chatgpt','openai','canva','zoom',
      'suscripcion','suscripción','subscription','membresía','membresia',
    ],
  },
  {
    categoria: 'Hogar',
    palabras: [
      'ferretería','ferreteria','home depot','cemento','pintura','mueble',
      'decoración','decoracion','electrodoméstico','electrodomestico',
      'nevera','lavadora','estufa','aire acondicionado','abanico',
      'alquiler','renta','hipoteca','condominio','mantenimiento hogar',
    ],
  },
  {
    categoria: 'Ropa',
    palabras: [
      'ropa','tienda','boutique','zara','h&m','forever21','nike','adidas',
      'zapato','calzado','tennis','camiseta','pantalon','pantalón',
      'vestido','blusa','camisa','jean','tela','confección','confeccion',
    ],
  },
  {
    categoria: 'Entretenimiento',
    palabras: [
      'cine','cinema','movie','teatro','concierto','evento','ticket',
      'boleto','entrada','parque','diversión','diversion','juego',
      'bowling','karting','laser','escape room','acuario','zoo',
    ],
  },
  {
    categoria: 'Salidas',
    palabras: [
      'bar','disco','club','discoteca','licor','bebida','cerveza',
      'ron ','vino ','whisky','cocktail','cóctel','copa','shots',
      'karaoke','lounge','rooftop','terraza',
    ],
  },
  {
    categoria: 'Mantenimiento Vehículo',
    palabras: [
      'taller','mecánico','mecanico','auto','carro','vehículo','vehiculo',
      'aceite','cambio de aceite','freno','llanta','goma','batería','bateria',
      'car wash','lavado','placa','itbis vehículo','seguro auto',
      'revisión técnica','peaje','toll',
    ],
  },
  {
    categoria: 'Vacaciones',
    palabras: [
      'hotel','resort','hostal','airbnb','booking','expedia',
      'vuelo','aerolinea','aerolínea','aeropuerto','turismo',
      'tour','excursión','excursion','viaje','paquete turístico',
    ],
  },
]

// ─── Extraer monto del texto OCR ──────────────────────────────────────────────
function extraerMonto(texto) {
  // Patrones comunes en recibos dominicanos
  const patrones = [
    // TOTAL: 1,250.00 o TOTAL RD$ 1,250.00
    /total\s*:?\s*(?:rd\$|rds|us\$|\$)?\s*([\d,]+\.?\d{0,2})/i,
    // MONTO: 1250.00
    /monto\s*:?\s*(?:rd\$|rds|us\$|\$)?\s*([\d,]+\.?\d{0,2})/i,
    // IMPORTE: 1250
    /importe\s*:?\s*(?:rd\$|rds|us\$|\$)?\s*([\d,]+\.?\d{0,2})/i,
    // A PAGAR: 1250.00
    /a\s*pagar\s*:?\s*(?:rd\$|rds|us\$|\$)?\s*([\d,]+\.?\d{0,2})/i,
    // SUBTOTAL seguido de número grande
    /subtotal\s*:?\s*(?:rd\$|rds|us\$|\$)?\s*([\d,]+\.?\d{0,2})/i,
    // RD$ 1,250.00 o $ 1,250.00 (el número más grande del recibo)
    /(?:rd\$|rds|us\$|\$)\s*([\d,]+\.?\d{0,2})/gi,
  ]

  let mejorMonto = null
  let mayorValor = 0

  for (const patron of patrones) {
    // matchAll requiere flag g siempre
    const flags   = patron.flags.includes('g') ? patron.flags : patron.flags + 'g'
    const regex   = new RegExp(patron.source, flags)
    const matches = [...texto.matchAll(regex)]
    for (const match of matches) {
      const valor = parseFloat((match[1] || '').replace(/,/g, ''))
      if (!isNaN(valor) && valor > 0 && valor > mayorValor) {
        mayorValor = valor
        mejorMonto = valor
      }
    }
  }

  return mejorMonto ? { monto: mejorMonto, fuente: 'mayor_valor' } : null
}

// ─── Extraer fecha del texto OCR ──────────────────────────────────────────────
function extraerFecha(texto) {
  const hoy = new Date()
  const patrones = [
    // DD/MM/YYYY o DD-MM-YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // YYYY-MM-DD
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    // DD de MES de YYYY
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/i,
  ]

  const meses = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12 }

  for (const patron of patrones) {
    const match = texto.match(patron)
    if (match) {
      try {
        let year, month, day
        if (patron.source.includes('enero')) {
          day   = parseInt(match[1])
          month = meses[match[2].toLowerCase()]
          year  = parseInt(match[3])
        } else if (match[1].length === 4) {
          year = parseInt(match[1]); month = parseInt(match[2]); day = parseInt(match[3])
        } else {
          day = parseInt(match[1]); month = parseInt(match[2]); year = parseInt(match[3])
        }
        if (year > 2020 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
        }
      } catch { continue }
    }
  }
  return hoy.toISOString().split('T')[0]
}

// ─── Extraer nombre del comercio ──────────────────────────────────────────────
function extraerComercio(texto) {
  const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 2)

  // Heurística: el comercio suele estar en las primeras líneas, en mayúsculas
  for (const linea of lineas.slice(0, 5)) {
    // Ignorar líneas que son solo números, fechas o palabras cortas
    if (linea.length < 3)  continue
    if (/^\d/.test(linea)) continue
    if (/^(ruc|rnc|nit|fecha|hora|factura|recibo|ticket|caja|cajero)/i.test(linea)) continue
    // Probable nombre de comercio
    if (linea.length >= 3 && linea.length <= 50) {
      return linea.replace(/[^\w\s\-\.áéíóúüñÁÉÍÓÚÜÑ]/g, '').trim()
    }
  }
  return ''
}

// ─── Detectar moneda ──────────────────────────────────────────────────────────
function detectarMoneda(texto) {
  if (/us\$|usd|dólar|dollar/i.test(texto)) return 'USD'
  return 'RD$'
}

// ─── Clasificador principal ───────────────────────────────────────────────────
export function clasificarGasto(textoOCR, comerciosAprendidos = []) {
  const textoLower = textoOCR.toLowerCase()

  // 1. Buscar en comercios aprendidos primero (mayor prioridad)
  const comercio = extraerComercio(textoOCR)
  if (comercio && comerciosAprendidos.length > 0) {
    const aprendido = comerciosAprendidos.find(c =>
      textoLower.includes(c.nombre_comercio?.toLowerCase()) ||
      (comercio.toLowerCase().includes(c.nombre_comercio?.toLowerCase()) && c.nombre_comercio?.length > 3)
    )
    if (aprendido && Number(aprendido.veces_confirmado) >= 1) {
      const montoData = extraerMonto(textoOCR)
      return {
        categoria:  aprendido.categoria,
        confianza:  Math.min(0.95, 0.75 + Number(aprendido.veces_confirmado) * 0.05),
        monto:      montoData?.monto || null,
        moneda:     detectarMoneda(textoOCR),
        comercio,
        fecha:      extraerFecha(textoOCR),
        fuente:     'aprendido',
        razon:      `Comercio "${aprendido.nombre_comercio}" aprendido ${aprendido.veces_confirmado} veces`,
        necesitaConfirmacion: false,
      }
    }
  }

  // 2. Aplicar reglas por palabras clave
  let mejorCategoria  = null
  let mejorPuntaje    = 0
  let mejorRazon      = ''

  for (const regla of REGLAS) {
    let puntaje = 0
    const encontradas = []
    for (const palabra of regla.palabras) {
      if (textoLower.includes(palabra)) {
        puntaje++
        encontradas.push(palabra)
      }
    }
    if (puntaje > mejorPuntaje) {
      mejorPuntaje    = puntaje
      mejorCategoria  = regla.categoria
      mejorRazon      = `Palabras encontradas: ${encontradas.slice(0,3).join(', ')}`
    }
  }

  const montoData = extraerMonto(textoOCR)
  const confianza = mejorCategoria
    ? Math.min(0.90, 0.50 + mejorPuntaje * 0.12)
    : 0.20

  return {
    categoria:  mejorCategoria || 'Hogar',
    confianza,
    monto:      montoData?.monto || null,
    moneda:     detectarMoneda(textoOCR),
    comercio,
    fecha:      extraerFecha(textoOCR),
    fuente:     'reglas',
    razon:      mejorRazon || 'No se encontraron palabras clave claras',
    necesitaConfirmacion: confianza < 0.75,
  }
}

// ─── Clasificador sin OCR (solo nombre de comercio) ───────────────────────────
export function clasificarPorComercio(nombreComercio, comerciosAprendidos = []) {
  return clasificarGasto(nombreComercio, comerciosAprendidos)
}
