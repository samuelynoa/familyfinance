// src/services/alertas.js — REEMPLAZAR la función verificarPresupuestos con esta:

import { presupuestosParaCategoria, getGastos } from './sheets'

/**
 * Verifica presupuestos al registrar un gasto y envía alertas si corresponde.
 * Ahora soporta presupuestos generales con múltiples categorías.
 */
export async function verificarPresupuestos(categoria, gastosDelMes, presupuestos, usuarios, { usuarioId = '', isAdmin = false } = {}) {
  // Encontrar el presupuesto que aplica — usando la nueva lógica de prioridad
  const resultado = await presupuestosParaCategoria(categoria, { usuarioId, isAdmin })
  if (resultado.tipo === 'ninguno' || resultado.tipo === 'ambiguo') return

  const presupuesto = resultado.presupuesto
  const limite = Number(presupuesto.monto_mensual_rdp || 0)
  if (!limite) return

  // Calcular gasto total del mes para TODAS las categorías de este presupuesto
  const cats = presupuesto._categorias || []
  const gastado = gastosDelMes
    .filter(g => cats.includes(g.categoria))
    .reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)

  const pct = (gastado / limite) * 100
  const debe80  = presupuesto.alerta_80  === 'true' && pct >= 80  && pct < 100
  const debe100 = presupuesto.alerta_100 === 'true' && pct >= 100

  if (!debe80 && !debe100) return

  // Enviar alerta a admins
  const admins = usuarios.filter(u => u.rol === 'admin' && u.email)
  for (const admin of admins) {
    await enviarAlertaPresupuesto({
      email:       admin.email,
      nombre:      admin.nombre,
      categoria:   presupuesto.nombre || categoria,
      gastado,
      presupuesto: limite,
      pct,
    })
  }
}
