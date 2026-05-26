import { useEffect, useState } from 'react'
import { getGastos, getIngresos, getCuentas, getSheet } from '../services/sheets'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Wallet, PieChart as PieIcon } from 'lucide-react'

const COLORES_GRAFICA = ['#2E6DA4','#1B5E35','#7A4800','#5B21B6','#BE185D','#0E7490','#B91C1C','#D97706','#059669','#7C3AED']

const CATEG_ICONS = {
  'Supermercado':'🛒','Combustible':'⛽','Educación':'📚','Salud':'🏥',
  'Entretenimiento':'🎬','Servicios (agua/luz/internet)':'💡','Comidas Fuera de Casa':'🍽️',
  'Suscripciones':'📱','Mesada Familiar':'👨‍👩‍👧','Préstamos':'🏦','Ahorros':'💰',
  'Salidas':'🎉','Ropa':'👗','Hogar':'🏠','Vacaciones':'✈️','Mantenimiento Vehículo':'🚗',
}

export default function Reportes() {
  const [loading,   setLoading]   = useState(true)
  const [gastos,    setGastos]    = useState([])
  const [ingresos,  setIngresos]  = useState([])
  const [cuentas,   setCuentas]   = useState([])
  const [prestamos, setPrestamos] = useState([])
  const [tab,       setTab]       = useState('resumen')
  const mes = format(new Date(), 'yyyy-MM')

  // Últimos 6 meses para gráfica de tendencia
  const meses6 = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i)
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM', { locale: es }) }
  })

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [g, ing, c, pre] = await Promise.all([
        getGastos({ mes }),
        getIngresos({ mes }),
        getCuentas(),
        getSheet('prestamos'),
      ])
      setGastos(g)
      setIngresos(ing)
      setCuentas(c)
      setPrestamos((pre.rows || []).filter(r => r.activo !== 'false'))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const totalGastos   = gastos.reduce((s, g)  => s + (Number(g.monto_rdp)  || 0), 0)
  const totalIngresos = ingresos.reduce((s, i) => s + (Number(i.monto_rdp) || 0), 0)
  const ahorro        = totalIngresos - totalGastos
  const totalActivos  = cuentas.filter(c => c.moneda === 'RD$').reduce((s, c) => s + (Number(c.balance) || 0), 0)
  const totalDeudas   = prestamos.reduce((s, p) => s + (Number(p.capital_pendiente) || 0), 0)
  const patrimonio    = totalActivos - totalDeudas

  // Gastos por categoría (para pie chart)
  const porCategoria = Object.entries(
    gastos.reduce((acc, g) => {
      const cat = g.categoria || 'Otro'
      acc[cat] = (acc[cat] || 0) + (Number(g.monto_rdp) || 0)
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))
   .sort((a, b) => b.value - a.value)
   .slice(0, 8)

  // Gastos personal vs familiar
  const gastosPersonal  = gastos.filter(g => g.personal_familiar === 'personal').reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)
  const gastosFamiliar  = gastos.filter(g => g.personal_familiar !== 'personal').reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)

  // Gastos con tarjeta vs cuenta
  const gastosTarjeta = gastos.filter(g => g.tarjeta_id).reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)
  const gastosCuenta  = gastos.filter(g => !g.tarjeta_id).reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)

  const mesLabel = format(new Date(), 'MMMM yyyy', { locale: es })

  if (loading) return <div className="spinner-center"><div className="spinner" /></div>

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Reportes</h2>

      {/* Tabs */}
      <div style={S.tabs}>
        {[
          { key: 'resumen',    label: '📊 Resumen' },
          { key: 'categorias', label: '🥧 Categorías' },
          { key: 'patrimonio', label: '🏦 Patrimonio' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            ...S.tab,
            background:  tab === t.key ? '#2E6DA4' : 'transparent',
            color:       tab === t.key ? '#fff' : '#4B5563',
            fontWeight:  tab === t.key ? 700 : 500,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab: Resumen ─────────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div>
          {/* KPIs del mes */}
          <p style={S.sectionTitle}>{mesLabel}</p>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <KpiCard icon={<TrendingUp size={18}/>}  label="Ingresos"  value={`RD$ ${fmtN(totalIngresos)}`} color="#1B5E35" bg="#D4EDDA" />
            <KpiCard icon={<TrendingDown size={18}/>} label="Gastos"    value={`RD$ ${fmtN(totalGastos)}`}   color="#DC2626" bg="#FEE2E2" />
          </div>

          {/* Ahorro del mes */}
          <div style={{
            ...S.ahorroCard,
            background: ahorro >= 0 ? '#D4EDDA' : '#FEE2E2',
            color:      ahorro >= 0 ? '#1B5E35' : '#DC2626',
          }}>
            <span style={{ fontWeight: 700 }}>{ahorro >= 0 ? '💚 Ahorro del mes' : '⚠️ Déficit del mes'}</span>
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>RD$ {fmtN(Math.abs(ahorro))}</span>
          </div>

          {/* Desglose personal vs familiar */}
          <p style={S.sectionTitle}>Gastos: personal vs familiar</p>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.75rem' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '.75rem', color: '#9CA3AF' }}>👤 Personal</p>
                <p style={{ fontWeight: 700, color: '#DC2626' }}>RD$ {fmtN(gastosPersonal)}</p>
                <p style={{ fontSize: '.72rem', color: '#9CA3AF' }}>
                  {totalGastos > 0 ? ((gastosPersonal / totalGastos) * 100).toFixed(0) : 0}%
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '.75rem', color: '#9CA3AF' }}>👨‍👩‍👧 Familiar</p>
                <p style={{ fontWeight: 700, color: '#DC2626' }}>RD$ {fmtN(gastosFamiliar)}</p>
                <p style={{ fontSize: '.72rem', color: '#9CA3AF' }}>
                  {totalGastos > 0 ? ((gastosFamiliar / totalGastos) * 100).toFixed(0) : 0}%
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '.75rem', color: '#9CA3AF' }}>💳 Tarjeta</p>
                <p style={{ fontWeight: 700, color: '#7A4800' }}>RD$ {fmtN(gastosTarjeta)}</p>
                <p style={{ fontSize: '.72rem', color: '#9CA3AF' }}>
                  {totalGastos > 0 ? ((gastosTarjeta / totalGastos) * 100).toFixed(0) : 0}%
                </p>
              </div>
            </div>
            {/* Barra comparativa */}
            {totalGastos > 0 && (
              <div style={{ height: 10, borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(gastosPersonal/totalGastos)*100}%`, background: '#5B21B6' }} />
                <div style={{ width: `${(gastosFamiliar/totalGastos)*100}%`, background: '#2E6DA4' }} />
                <div style={{ flex: 1, background: '#D97706' }} />
              </div>
            )}
          </div>

          {/* Top 5 gastos del mes */}
          <p style={S.sectionTitle}>Top gastos del mes</p>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {[...gastos]
              .sort((a, b) => (Number(b.monto_rdp)||0) - (Number(a.monto_rdp)||0))
              .slice(0, 5)
              .map((g, i, arr) => (
                <div key={g.id || i} style={{ display:'flex',alignItems:'center',gap:'.85rem',padding:'.8rem 1rem',borderBottom:i<arr.length-1?'1px solid #F3F4F6':'none' }}>
                  <div style={{ width:38,height:38,borderRadius:10,background:'#F3F4F6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0 }}>
                    {CATEG_ICONS[g.categoria]||'💸'}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:600,fontSize:'.875rem' }}>{g.comercio||g.descripcion||g.categoria}</p>
                    <p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>{g.categoria} · {g.fecha}</p>
                  </div>
                  <p style={{ fontWeight:700,color:'#DC2626',fontSize:'.875rem' }}>
                    RD$ {fmtN(Number(g.monto_rdp||0))}
                  </p>
                </div>
              ))
            }
            {gastos.length === 0 && (
              <p style={{ padding:'1.5rem',textAlign:'center',color:'#9CA3AF' }}>Sin gastos este mes</p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Categorías ──────────────────────────────────────────────────── */}
      {tab === 'categorias' && (
        <div>
          <p style={S.sectionTitle}>Gastos por categoría — {mesLabel}</p>

          {porCategoria.length === 0 ? (
            <div style={S.empty}><PieIcon size={40} color="#9CA3AF"/><p>Sin gastos este mes</p></div>
          ) : (
            <>
              {/* Pie chart */}
              <div className="card" style={{ marginBottom: '1rem' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={porCategoria} dataKey="value" cx="50%" cy="50%"
                      innerRadius={55} outerRadius={90} paddingAngle={3}>
                      {porCategoria.map((_, i) => (
                        <Cell key={i} fill={COLORES_GRAFICA[i % COLORES_GRAFICA.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => `RD$ ${fmtN(v)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Lista detallada */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {porCategoria.map((c, i) => {
                  const pct = totalGastos > 0 ? (c.value / totalGastos) * 100 : 0
                  return (
                    <div key={c.name} style={{ padding:'.75rem 1rem',borderBottom:i<porCategoria.length-1?'1px solid #F3F4F6':'none' }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.35rem' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:'.5rem' }}>
                          <span style={{ fontSize:'1.1rem' }}>{CATEG_ICONS[c.name]||'💸'}</span>
                          <span style={{ fontWeight:600,fontSize:'.875rem' }}>{c.name}</span>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ fontWeight:700,fontSize:'.875rem',color:'#DC2626' }}>RD$ {fmtN(c.value)}</p>
                          <p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>{pct.toFixed(0)}%</p>
                        </div>
                      </div>
                      <div style={{ height:5,background:'#F3F4F6',borderRadius:99 }}>
                        <div style={{ height:'100%',width:`${pct}%`,background:COLORES_GRAFICA[i%COLORES_GRAFICA.length],borderRadius:99 }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Patrimonio ──────────────────────────────────────────────────── */}
      {tab === 'patrimonio' && (
        <div>
          {/* Patrimonio neto */}
          <div style={{ ...S.ahorroCard, background: patrimonio >= 0 ? '#EEF5FC' : '#FEE2E2', color: patrimonio >= 0 ? '#1E3A5F' : '#DC2626', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 700 }}>🏦 Patrimonio neto</span>
            <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>RD$ {fmtN(Math.abs(patrimonio))}</span>
          </div>

          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <KpiCard icon={<Wallet size={18}/>}       label="Activos RD$"      value={`RD$ ${fmtN(totalActivos)}`} color="#1E3A5F" bg="#EEF5FC" />
            <KpiCard icon={<TrendingDown size={18}/>} label="Deudas pendientes" value={`RD$ ${fmtN(totalDeudas)}`}  color="#DC2626" bg="#FEE2E2" />
          </div>

          {/* Cuentas */}
          <p style={S.sectionTitle}>Cuentas activas</p>
          <div className="card" style={{ padding:0,overflow:'hidden',marginBottom:'1rem' }}>
            {cuentas.length === 0
              ? <p style={{ padding:'1.5rem',textAlign:'center',color:'#9CA3AF' }}>Sin cuentas</p>
              : cuentas.map((c, i) => (
                <div key={c.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.8rem 1rem',borderBottom:i<cuentas.length-1?'1px solid #F3F4F6':'none' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:'.75rem' }}>
                    <div style={{ width:10,height:10,borderRadius:'50%',background:c.color||'#2E6DA4',flexShrink:0 }}/>
                    <div>
                      <p style={{ fontWeight:600,fontSize:'.875rem' }}>{c.nombre}</p>
                      <p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>{c.tipo}{c.solo_consulta==='true'?' · Solo consulta':''}</p>
                    </div>
                  </div>
                  <p style={{ fontWeight:700,fontSize:'.875rem' }}>
                    {c.moneda==='USD'?'$':'RD$'} {fmtN(Number(c.balance||0))}
                  </p>
                </div>
              ))
            }
          </div>

          {/* Préstamos */}
          {prestamos.length > 0 && (
            <>
              <p style={S.sectionTitle}>Préstamos pendientes</p>
              <div className="card" style={{ padding:0,overflow:'hidden' }}>
                {prestamos.map((p, i) => (
                  <div key={p.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.8rem 1rem',borderBottom:i<prestamos.length-1?'1px solid #F3F4F6':'none' }}>
                    <div>
                      <p style={{ fontWeight:600,fontSize:'.875rem' }}>{p.nombre}</p>
                      <p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>Cuota: RD$ {fmtN(Number(p.cuota_mensual))}</p>
                    </div>
                    <p style={{ fontWeight:700,color:'#DC2626',fontSize:'.875rem' }}>
                      RD$ {fmtN(Number(p.capital_pendiente))}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, color, bg }) {
  return (
    <div className="card" style={{ padding:'1rem' }}>
      <div style={{ display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'.4rem' }}>
        <div style={{ background:bg,color,borderRadius:8,padding:'.3rem',display:'flex' }}>{icon}</div>
        <span style={{ fontSize:'.75rem',color:'#9CA3AF',fontWeight:600 }}>{label}</span>
      </div>
      <p style={{ fontWeight:800,fontSize:'1rem',color }}>{value}</p>
    </div>
  )
}

const fmtN = n => Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const S = {
  tabs: { display:'flex',background:'#F3F4F6',borderRadius:12,padding:'.25rem',marginBottom:'1rem',gap:'.25rem' },
  tab:  { flex:1,padding:'.55rem .4rem',borderRadius:9,border:'none',cursor:'pointer',fontSize:'.78rem',transition:'all .15s' },
  sectionTitle: { fontSize:'.78rem',fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.6rem',marginTop:'.25rem' },
  ahorroCard: { display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.85rem 1rem',borderRadius:12,marginBottom:'1rem' },
  empty: { display:'flex',flexDirection:'column',alignItems:'center',gap:'.75rem',padding:'3rem 1rem',textAlign:'center',color:'#9CA3AF' },
}
