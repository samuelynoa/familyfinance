// src/services/alertas.js
// Alertas de presupuesto por email via EmailJS (200 emails/mes gratis)
// Setup: https://www.emailjs.com → crear cuenta → crear servicio → crear template

const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || ''
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || ''
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || ''

let emailjsLoaded = false

async function loadEmailJS() {
  if (emailjsLoaded || window.emailjs) { emailjsLoaded = true; return }
  return new Promise((resolve, reject) => {
    const script    = document.createElement('script')
    script.src      = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'
    script.onload   = () => { emailjsLoaded = true; resolve() }
    script.onerror  = reject
    document.head.appendChild(script)
  })
}

/**
 * Envía alerta de presupuesto por email
 */
export async function enviarAlertaPresupuesto({ email, nombre, categoria, gastado, presupuesto, pct }) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    console.warn('[Alertas] EmailJS no configurado — omitiendo alerta')
    return false
  }
  try {
    await loadEmailJS()
    window.emailjs.init(EMAILJS_PUBLIC_KEY)
    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email:   email,
      to_name:    nombre,
      categoria,
      gastado:    `RD$ ${Number(gastado).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      presupuesto:`RD$ ${Number(presupuesto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      porcentaje: `${pct.toFixed(0)}%`,
      mensaje:    pct >= 100
        ? `¡Has agotado el presupuesto de ${categoria} este mes!`
        : `Has usado el ${pct.toFixed(0)}% del presupuesto de ${categoria}.`,
    })
    return true
  } catch (e) {
    console.warn('[Alertas] Error enviando email:', e.message)
    return false
  }
}

/**
 * Verifica presupuestos y envía alertas si corresponde
 * Llamar después de registrar un gasto
 */
export async function verificarPresupuestos(categoria, gastosDelMes, presupuestos, usuarios) {
  const presupuesto = presupuestos.find(p => p.categoria === categoria)
  if (!presupuesto) return

  const limite  = Number(presupuesto.monto_mensual_rdp || 0)
  if (!limite) return

  const gastado = gastosDelMes
    .filter(g => g.categoria === categoria)
    .reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)

  const pct = (gastado / limite) * 100

  // Verificar si debe alertar
  const debe80  = presupuesto.alerta_80  === 'true' && pct >= 80  && pct < 100
  const debe100 = presupuesto.alerta_100 === 'true' && pct >= 100

  if (!debe80 && !debe100) return

  // Enviar a todos los admins
  const admins = usuarios.filter(u => u.rol === 'admin' && u.email)
  for (const admin of admins) {
    await enviarAlertaPresupuesto({
      email:       admin.email,
      nombre:      admin.nombre,
      categoria,
      gastado,
      presupuesto: limite,
      pct,
    })
  }
}
