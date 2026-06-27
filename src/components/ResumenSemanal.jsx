import { useMemo } from 'react'
import {
  startOfWeek, endOfWeek, subWeeks, format, isWithinInterval, parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'

const CATEG_ICONS = {
  'Supermercado':'🛒','Combustible':'⛽','Educación':'📚','Salud':'🏥',
  'Entretenimiento':'🎬','Servicios (agua/luz/internet)':'💡','Comidas Fuera de Casa':'🍽️',
  'Suscripciones':'📱','Mesada Familiar':'👨‍👩‍👧','Préstamos':'🏦','Ahorros':'💰',
  'Salidas':'🎉','Ropa':'👗','Hogar':'🏠','Vacaciones':'✈️','Mantenimiento Vehículo':'🚗',
}

// Filtra gastos dentro de un rango de fechas
function gastosEnRango(gastos, desde, hasta) {
  return gastos.filter(g => {
    if (!g.fecha) return false
    try {
      const fecha = parseISO(g.fecha)
      return isWithinInterval(fecha, { start: desde, end: hasta })
    } catch { return false }
  })
}

// Suma montos RD$ de una lista de gastos
function sumar(gastos) {
  return gastos.reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)
}

// Variación porcentual con signo
function variacion(actual, anterior) {
  if (!anterior) return actual > 0 ? 100 : 0
  return ((actual - anterior) / anterior) * 100
}

export default function ResumenSemanal({ gastosMes, hideBalances }) {
  const hoy = new Date()

  // Semanas (lunes a domingo)
  const semanas = useMemo(() => {
    return [0, 1, 2, 3].map(i => {
      const ref   = subWeeks(hoy, i)
      const ini   = startOfWeek(ref, { weekStartsOn: 1 })
      const fin   = endOfWeek(ref,   { weekStartsOn: 1 })
      const items = gastosEnRango(gastosMes, ini, fin)
      const total = sumar(items)
      const label = i === 0 ? 'Esta semana'
                  : i === 1 ? 'Sem. pasada'
                  : format(ini, "'Sem' d MMM", { locale: es })
      return { ini, fin, items, total, label }
    }).reverse() // [más antigua ... actual]
  }, [gastosMes])

  const actual   = semanas[3] // esta semana
  const anterior = semanas[2] // semana pasada
  const delta    = actual.total - anterior.total
  const pct      = variacion(actual.total, anterior.total)
  const mejoro   = delta <= 0 // gastar menos = mejoró

  // Top categorías esta semana
  const topCats = useMemo(() => {
    const mapa = {}
    actual.items.forEach(g => {
      const cat = g.categoria || 'Otro'
      mapa[cat] = (mapa[cat] || 0) + (Number(g.monto_rdp) || 0)
    })
    return Object.entries(mapa)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat, tot]) => {
        // Buscar la misma categoría la semana anterior
        const antItems = anterior.items.filter(g => g.categoria === cat)
        const antTot   = sumar(antItems)
        return { cat, tot, antTot, delta: tot - antTot }
      })
  }, [actual, anterior])

  // Máximo para escalar las barras del sparkline
  const maxTotal = Math.max(...semanas.map(s => s.total), 1)

  if (actual.total === 0 && anterior.total === 0) return null

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.85rem' }}>
        <h3 style={{ fontWeight:700, fontSize:'1rem', color:'var(--color-text,#1F2937)' }}>
          📅 Resumen semanal
        </h3>
        <span style={{ fontSize:'.72rem', color:'#9CA3AF' }}>
          {format(actual.ini,'d MMM',{locale:es})} – {format(actual.fin,'d MMM',{locale:es})}
        </span>
      </div>

      {/* Esta semana vs semana pasada */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.65rem', marginBottom:'1rem' }}>
        <div style={{ ...S.statBox, border:'2px solid #2E6DA4' }}>
          <p style={{ fontSize:'.72rem', color:'#9CA3AF', marginBottom:'.2rem' }}>Esta semana</p>
          <p style={{ fontWeight:800, fontSize:'1.05rem', color:'#DC2626' }}>
            {hideBalances ? '••••' : fmtK(actual.total)}
          </p>
          <p style={{ fontSize:'.68rem', color:'#9CA3AF', marginTop:'.15rem' }}>
            {actual.items.length} gasto{actual.items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={S.statBox}>
          <p style={{ fontSize:'.72rem', color:'#9CA3AF', marginBottom:'.2rem' }}>Sem. pasada</p>
          <p style={{ fontWeight:800, fontSize:'1.05rem', color:'#6B7280' }}>
            {hideBalances ? '••••' : fmtK(anterior.total)}
          </p>
          <p style={{ fontSize:'.68rem', color:'#9CA3AF', marginTop:'.15rem' }}>
            {anterior.items.length} gasto{anterior.items.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Variación */}
      {(actual.total > 0 || anterior.total > 0) && (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          background: mejoro ? '#D4EDDA' : '#FEE2E2',
          borderRadius:10, padding:'.65rem .9rem', marginBottom:'1rem',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
            <span style={{ fontSize:'1.1rem' }}>{mejoro ? '📉' : '📈'}</span>
            <div>
              <p style={{ fontWeight:700, fontSize:'.85rem', color: mejoro?'#1B5E35':'#DC2626' }}>
                {mejoro ? 'Gastas menos' : 'Gastas más'} que la semana pasada
              </p>
              <p style={{ fontSize:'.72rem', color: mejoro?'#1B5E35':'#DC2626', opacity:.8 }}>
                {hideBalances ? '••••' : `${delta > 0 ? '+' : ''}RD$ ${fmtN(Math.abs(delta))}`}
              </p>
            </div>
          </div>
          <div style={{
            fontWeight:800, fontSize:'1rem', color: mejoro?'#1B5E35':'#DC2626',
            background: mejoro?'#BBF7D0':'#FCA5A5', borderRadius:99,
            padding:'.25rem .65rem', flexShrink:0,
          }}>
            {Math.abs(pct).toFixed(0)}%
          </div>
        </div>
      )}

      {/* Sparkline — 4 semanas */}
      <div className="card" style={{ padding:'.85rem', marginBottom:'1rem' }}>
        <p style={{ fontSize:'.72rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase',
          letterSpacing:'.05em', marginBottom:'.65rem' }}>
          Últimas 4 semanas
        </p>
        <div style={{ display:'flex', alignItems:'flex-end', gap:'.5rem', height:72 }}>
          {semanas.map((s, i) => {
            const isActual  = i === semanas.length - 1
            const heightPct = maxTotal > 0 ? (s.total / maxTotal) * 100 : 0
            const height    = Math.max(heightPct * 0.68, s.total > 0 ? 6 : 2) // px relativos
            return (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'.3rem' }}>
                {/* Valor encima de la barra */}
                {!hideBalances && s.total > 0 && (
                  <span style={{ fontSize:'.6rem', fontWeight:700,
                    color: isActual?'#1E3A5F':'#9CA3AF', whiteSpace:'nowrap' }}>
                    {fmtK(s.total)}
                  </span>
                )}
                {/* Barra */}
                <div style={{ flex:1, width:'100%', display:'flex', alignItems:'flex-end' }}>
                  <div style={{
                    width:'100%',
                    height: `${Math.max(heightPct, s.total > 0 ? 8 : 3)}%`,
                    minHeight: s.total > 0 ? 6 : 2,
                    borderRadius: '6px 6px 0 0',
                    background: isActual
                      ? 'linear-gradient(180deg,#2E6DA4,#1E3A5F)'
                      : 'var(--color-border,#E5E7EB)',
                    transition: 'height .4s ease',
                  }}/>
                </div>
                {/* Label */}
                <span style={{ fontSize:'.62rem', fontWeight: isActual?700:400,
                  color: isActual?'#2E6DA4':'#9CA3AF', textAlign:'center', lineHeight:1.2,
                  whiteSpace:'nowrap' }}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top categorías */}
      {topCats.length > 0 && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <p style={{ fontSize:'.72rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase',
            letterSpacing:'.05em', padding:'.65rem .85rem .3rem' }}>
            Top categorías esta semana
          </p>
          {topCats.map(({ cat, tot, antTot, delta }, i) => {
            const subio = delta > 0
            const igual = Math.abs(delta) < 1
            return (
              <div key={cat} style={{
                display:'flex', alignItems:'center', gap:'.75rem',
                padding:'.65rem .85rem',
                borderTop: i > 0 ? '1px solid var(--color-border-secondary,#F3F4F6)' : 'none',
              }}>
                <span style={{ fontSize:'1.15rem', flexShrink:0 }}>{CATEG_ICONS[cat]||'💸'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:600, fontSize:'.875rem',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat}</p>
                  {/* Mini barra relativa al máximo de la lista */}
                  <div style={{ height:4, background:'var(--color-border-secondary,#F3F4F6)', borderRadius:99, marginTop:'.25rem' }}>
                    <div style={{
                      height:'100%', borderRadius:99,
                      width:`${topCats[0].tot > 0 ? (tot/topCats[0].tot)*100 : 0}%`,
                      background:'#2E6DA4',
                    }}/>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p style={{ fontWeight:700, fontSize:'.875rem', color:'#DC2626' }}>
                    {hideBalances ? '••••' : `RD$ ${fmtN(tot)}`}
                  </p>
                  {!igual && antTot > 0 && (
                    <p style={{ fontSize:'.68rem', color: subio?'#DC2626':'#1B5E35', marginTop:'.1rem' }}>
                      {subio ? '▲' : '▼'} {Math.abs(((delta/antTot)*100)).toFixed(0)}% vs ant.
                    </p>
                  )}
                  {igual && <p style={{ fontSize:'.68rem', color:'#9CA3AF' }}>= igual</p>}
                  {!igual && antTot === 0 && <p style={{ fontSize:'.68rem', color:'#9CA3AF' }}>Nuevo</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Formatea en K cuando > 1000 para ahorrar espacio en barras
const fmtK  = n => n >= 1000 ? `RD$${(n/1000).toFixed(1)}k` : `RD$${fmtN(n)}`
const fmtN  = n => Number(n).toLocaleString('es-DO', { minimumFractionDigits:0, maximumFractionDigits:0 })

const S = {
  wrap: { marginBottom:'1.5rem' },
  statBox: {
    background:'var(--color-card,#fff)',
    border:'1px solid var(--color-border,#E5E7EB)',
    borderRadius:12, padding:'.75rem',
  },
}
