import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getGastos, getIngresos, getCuentas, getSheet } from '../services/sheets'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Wallet, Download, ChevronLeft, X } from 'lucide-react'

const COLORES = ['#2E6DA4','#1B5E35','#7A4800','#5B21B6','#BE185D','#0E7490','#B91C1C','#D97706','#059669','#7C3AED']
const ICONS   = { 'Supermercado':'🛒','Combustible':'⛽','Educación':'📚','Salud':'🏥','Entretenimiento':'🎬','Servicios (agua/luz/internet)':'💡','Comidas Fuera de Casa':'🍽️','Suscripciones':'📱','Mesada Familiar':'👨‍👩‍👧','Préstamos':'🏦','Ahorros':'💰','Salidas':'🎉','Ropa':'👗','Hogar':'🏠','Vacaciones':'✈️','Mantenimiento Vehículo':'🚗' }

export default function Reportes() {
  const { perfil, isAdmin } = useAuth()
  const [gastos,    setGastos]    = useState([])
  const [ingresos,  setIngresos]  = useState([])
  const [cuentas,   setCuentas]   = useState([])
  const [prestamos, setPrestamos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('resumen')
  const mes = format(new Date(), 'yyyy-MM')

  // ── Comparativa mensual ──────────────────────────────────────────────────────
  // Cache de gastos históricos: { 'yyyy-MM': gastos[] }
  const cacheRef      = useRef({})
  const [mesesDisp,   setMesesDisp]   = useState([]) // 12 meses disponibles
  const [mesesSel,    setMesesSel]    = useState([]) // meses seleccionados
  const [datosMeses,  setDatosMeses]  = useState({}) // { 'yyyy-MM': { total, categorias } }
  const [loadingComp, setLoadingComp] = useState(false)
  const [drillMes,    setDrillMes]    = useState(null) // mes en drilldown

  useEffect(() => { load() }, [perfil])

  async function load() {
    try {
      const [g, i, c, pre] = await Promise.all([
        getGastos({ mes }),
        getIngresos({ mes }),
        getCuentas({ usuarioId: perfil?.id, isAdmin }),
        getSheet('prestamos'),
      ])
      setGastos(g)
      setIngresos(i)
      setCuentas(c)
      setPrestamos((pre.rows || []).filter(r => {
        if (r.activo === 'false') return false
        if (r.visibilidad === 'privada') return isAdmin || r.owner_id === perfil?.id
        return true
      }))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // Genera los 12 meses recientes al montar
  useEffect(() => {
    const hoy   = new Date()
    const lista = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(hoy, i)
      return format(d, 'yyyy-MM')
    })
    setMesesDisp(lista)
    // Pre-seleccionar los últimos 6
    setMesesSel(lista.slice(0, 6).reverse())
  }, [])

  // Carga gastos de meses seleccionados usando caché
  const cargarMeses = useCallback(async (meses) => {
    setLoadingComp(true)
    const nuevos = {}
    for (const m of meses) {
      if (cacheRef.current[m]) {
        nuevos[m] = cacheRef.current[m]
        continue
      }
      try {
        const g = await getGastos({ mes: m })
        const i = await getIngresos({ mes: m })
        const totalGastos   = g.reduce((s, x) => s + (Number(x.monto_rdp) || 0), 0)
        const totalIngresos = i.filter(x => (x.visibilidad||'privada') === 'familiar')
                               .reduce((s, x) => s + (Number(x.monto_rdp) || 0), 0)
        // Agrupar por categoría
        const cats = {}
        g.forEach(x => {
          const cat = x.categoria || 'Otro'
          cats[cat] = (cats[cat] || 0) + (Number(x.monto_rdp) || 0)
        })
        const dato = { total: totalGastos, ingresos: totalIngresos, categorias: cats, count: g.length }
        cacheRef.current[m] = dato
        nuevos[m] = dato
      } catch (e) { console.error('Error cargando', m, e) }
    }
    setDatosMeses(prev => ({ ...prev, ...nuevos }))
    setLoadingComp(false)
  }, [])

  // Cargar cuando cambian meses seleccionados
  useEffect(() => {
    if (mesesSel.length > 0) cargarMeses(mesesSel)
  }, [mesesSel])

  // ── Ingresos separados por visibilidad ──────────────────────────────────────
  const ingresosFamiliares = ingresos.filter(i => (i.visibilidad || 'privada') === 'familiar')
  const ingresosPrivados   = ingresos.filter(i => (i.visibilidad || 'privada') === 'privada' && (isAdmin || i.owner_id === perfil?.id))

  const totalIngresosFamiliar = ingresosFamiliares.reduce((s, i) => s + (Number(i.monto_rdp) || 0), 0)
  const totalIngresosPrivado  = ingresosPrivados.reduce((s, i)   => s + (Number(i.monto_rdp) || 0), 0)
  const totalIngresosTotal    = totalIngresosFamiliar + totalIngresosPrivado

  // ── Gastos ──────────────────────────────────────────────────────────────────
  const totalGastos = gastos.reduce((s, g) => s + (Number(g.monto_rdp) || 0), 0)
  const ahorro      = totalIngresosFamiliar - totalGastos  // ahorro familiar

  // ── Gastos por categoría ────────────────────────────────────────────────────
  const porCategoria = Object.entries(
    gastos.reduce((acc, g) => { const c = g.categoria || 'Otro'; acc[c] = (acc[c] || 0) + (Number(g.monto_rdp) || 0); return acc }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)

  // ── Patrimonio separado ─────────────────────────────────────────────────────
  const cuentasFamiliares = cuentas.filter(c => (c.visibilidad || 'familiar') === 'familiar')
  const cuentasPrivadas   = cuentas.filter(c => c.visibilidad === 'privada')

  const activosFamiliar = cuentasFamiliares.filter(c => c.moneda === 'RD$').reduce((s, c) => s + (Number(c.balance) || 0), 0)
  const activosPrivado  = cuentasPrivadas.filter(c => c.moneda === 'RD$').reduce((s, c)   => s + (Number(c.balance) || 0), 0)

  const prestamosFamiliares = prestamos.filter(p => (p.visibilidad || 'familiar') === 'familiar')
  const prestamosPrivados   = prestamos.filter(p => p.visibilidad === 'privada')

  const deudasFamiliar = prestamosFamiliares.reduce((s, p) => s + (Number(p.capital_pendiente) || 0), 0)
  const deudasPrivado  = prestamosPrivados.reduce((s, p)   => s + (Number(p.capital_pendiente) || 0), 0)

  const patrimonioFamiliar = activosFamiliar - deudasFamiliar
  const patrimonioPrivado  = activosPrivado  - deudasPrivado
  const patrimonioTotal    = patrimonioFamiliar + patrimonioPrivado

  const mesLabel = format(new Date(), 'MMMM yyyy', { locale: es })

  if (loading) return <div className="spinner-center"><div className="spinner"/></div>

  return (
    <div>
      <h2 style={{ fontWeight:700, marginBottom:'1rem' }}>Reportes</h2>

      {/* Tabs */}
      <div style={S.tabs}>
        {[
          {k:'resumen',    l:'📊 Resumen'},
          {k:'categorias', l:'🥧 Categorías'},
          {k:'patrimonio', l:'🏦 Patrimonio'},
          {k:'comparativa',l:'📈 Meses'},
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            ...S.tab,
            background: tab===t.k ? '#2E6DA4' : 'transparent',
            color:      tab===t.k ? '#fff'    : '#4B5563',
            fontWeight: tab===t.k ? 700       : 500,
          }}>{t.l}</button>
        ))}
      </div>

      {/* ── Resumen ──────────────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div>
          <p style={S.secTitle}>{mesLabel}</p>

          {/* Ingresos separados */}
          <div style={{ marginBottom:'1rem' }}>
            <p style={S.secTitle}>Ingresos del mes</p>
            <div className="grid-2" style={{ marginBottom:'.5rem' }}>
              <KpiCard icon={<TrendingUp size={18}/>}  label="Familiar"  value={`RD$ ${fmtN(totalIngresosFamiliar)}`} color="#1B5E35" bg="#D4EDDA"/>
              <KpiCard icon={<TrendingUp size={18}/>}  label="Privado"   value={`RD$ ${fmtN(totalIngresosPrivado)}`}  color="#5B21B6" bg="#EDE9FE"/>
            </div>
            <div style={{ background:'var(--color-card-hover,#F9FAFB)', borderRadius:10, padding:'.6rem 1rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'.82rem', color:'var(--color-text-secondary,#6B7280)', fontWeight:600 }}>Total ingresos</span>
              <span style={{ fontWeight:800, color:'#1B5E35' }}>RD$ {fmtN(totalIngresosTotal)}</span>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom:'1rem' }}>
            <KpiCard icon={<TrendingDown size={18}/>} label="Gastos familiares" value={`RD$ ${fmtN(totalGastos)}`} color="#DC2626" bg="#FEE2E2"/>
            <div className="card" style={{ padding:'1rem' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'.4rem' }}>
                <div style={{ background: ahorro>=0?'#D4EDDA':'#FEE2E2', color: ahorro>=0?'#1B5E35':'#DC2626', borderRadius:8, padding:'.3rem', display:'flex' }}>
                  {ahorro>=0 ? <TrendingUp size={18}/> : <TrendingDown size={18}/>}
                </div>
                <span style={{ fontSize:'.75rem',color:'#9CA3AF',fontWeight:600 }}>Ahorro familiar</span>
              </div>
              <p style={{ fontWeight:800,fontSize:'1rem', color: ahorro>=0?'#1B5E35':'#DC2626' }}>RD$ {fmtN(Math.abs(ahorro))}</p>
              <p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>{ahorro>=0?'superávit':'déficit'}</p>
            </div>
          </div>

          {/* Personal vs familiar */}
          <p style={S.secTitle}>Gastos por tipo</p>
          <div className="card" style={{ marginBottom:'1rem' }}>
            {[
              { label:'👨‍👩‍👧 Familiar', valor: gastos.filter(g=>g.personal_familiar!=='personal').reduce((s,g)=>s+(Number(g.monto_rdp)||0),0) },
              { label:'👤 Personal',  valor: gastos.filter(g=>g.personal_familiar==='personal').reduce((s,g)=>s+(Number(g.monto_rdp)||0),0) },
              { label:'💳 Tarjeta',   valor: gastos.filter(g=>g.tarjeta_id).reduce((s,g)=>s+(Number(g.monto_rdp)||0),0) },
            ].map(({label, valor}) => {
              const pct = totalGastos>0 ? (valor/totalGastos)*100 : 0
              return (
                <div key={label} style={{ marginBottom:'.75rem' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'.25rem' }}>
                    <span style={{ fontSize:'.85rem',fontWeight:600 }}>{label}</span>
                    <span style={{ fontSize:'.82rem',fontWeight:700,color:'#DC2626' }}>RD$ {fmtN(valor)} <span style={{ color:'#9CA3AF',fontWeight:400 }}>({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div style={{ height:6,background:'var(--color-card-hover,#F3F4F6)',borderRadius:99 }}>
                    <div style={{ height:'100%',width:`${pct}%`,background:'#2E6DA4',borderRadius:99 }}/>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Top gastos */}
          <p style={S.secTitle}>Top gastos del mes</p>
          <div className="card" style={{ padding:0,overflow:'hidden' }}>
            {[...gastos].sort((a,b)=>(Number(b.monto_rdp)||0)-(Number(a.monto_rdp)||0)).slice(0,5).map((g,i,arr) => (
              <div key={g.id||i} style={{ display:'flex',alignItems:'center',gap:'.85rem',padding:'.8rem 1rem',borderBottom:i<arr.length-1?'1px solid #F3F4F6':'none' }}>
                <div style={{ width:38,height:38,borderRadius:10,background:'var(--color-card-hover,#F3F4F6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0 }}>{ICONS[g.categoria]||'💸'}</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:600,fontSize:'.875rem' }}>{g.comercio||g.descripcion||g.categoria}</p>
                  <p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>{g.categoria} · {g.fecha}</p>
                </div>
                <p style={{ fontWeight:700,color:'#DC2626',fontSize:'.875rem' }}>RD$ {fmtN(Number(g.monto_rdp||0))}</p>
              </div>
            ))}
            {gastos.length===0 && <p style={{ padding:'1.5rem',textAlign:'center',color:'#9CA3AF' }}>Sin gastos este mes</p>}
          </div>
        </div>
      )}

      {/* ── Categorías ───────────────────────────────────────────────────────── */}
      {tab === 'categorias' && (
        <div>
          <p style={S.secTitle}>Gastos por categoría — {mesLabel}</p>
          {porCategoria.length === 0 ? (
            <div style={S.empty}>📊<br/>Sin gastos este mes</div>
          ) : (
            <>
              <div className="card" style={{ marginBottom:'1rem' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={porCategoria} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {porCategoria.map((_,i) => <Cell key={i} fill={COLORES[i%COLORES.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v=>`RD$ ${fmtN(v)}`}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card" style={{ padding:0,overflow:'hidden' }}>
                {porCategoria.map((c,i) => {
                  const pct = totalGastos>0 ? (c.value/totalGastos)*100 : 0
                  return (
                    <div key={c.name} style={{ padding:'.75rem 1rem',borderBottom:i<porCategoria.length-1?'1px solid #F3F4F6':'none' }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.3rem' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:'.5rem' }}>
                          <span style={{ fontSize:'1.1rem' }}>{ICONS[c.name]||'💸'}</span>
                          <span style={{ fontWeight:600,fontSize:'.875rem' }}>{c.name}</span>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ fontWeight:700,fontSize:'.875rem',color:'#DC2626' }}>RD$ {fmtN(c.value)}</p>
                          <p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>{pct.toFixed(0)}%</p>
                        </div>
                      </div>
                      <div style={{ height:5,background:'var(--color-card-hover,#F3F4F6)',borderRadius:99 }}>
                        <div style={{ height:'100%',width:`${pct}%`,background:COLORES[i%COLORES.length],borderRadius:99 }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Patrimonio ───────────────────────────────────────────────────────── */}
      {tab === 'patrimonio' && (
        <div>
          {/* 3 patrimonios */}
          <p style={S.secTitle}>Patrimonio neto</p>
          <div style={{ display:'flex',flexDirection:'column',gap:'.75rem',marginBottom:'1.25rem' }}>
            <PatrimonioCard label="👨‍👩‍👧 Familiar"  activos={activosFamiliar} deudas={deudasFamiliar} color="#2E6DA4" bg="linear-gradient(135deg,#1E3A5F,#2E6DA4)"/>
            <PatrimonioCard label="🔒 Privado"    activos={activosPrivado}  deudas={deudasPrivado}  color="#5B21B6" bg="linear-gradient(135deg,#3E1A6B,#5B21B6)"/>
            <PatrimonioCard label="💎 Total"       activos={activosFamiliar+activosPrivado} deudas={deudasFamiliar+deudasPrivado} color="#0E7490" bg="linear-gradient(135deg,#0E4F5C,#0E7490)" destacado/>
          </div>

          {/* Cuentas */}
          <p style={S.secTitle}>Cuentas activas</p>
          <div className="card" style={{ padding:0,overflow:'hidden',marginBottom:'1rem' }}>
            {cuentas.length===0
              ? <p style={{ padding:'1.5rem',textAlign:'center',color:'#9CA3AF' }}>Sin cuentas</p>
              : cuentas.map((c,i) => (
                <div key={c.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.8rem 1rem',borderBottom:i<cuentas.length-1?'1px solid #F3F4F6':'none' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:'.75rem' }}>
                    <div style={{ width:10,height:10,borderRadius:'50%',background:c.color||'#2E6DA4',flexShrink:0 }}/>
                    <div>
                      <p style={{ fontWeight:600,fontSize:'.875rem' }}>{c.nombre}</p>
                      <p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>{c.visibilidad==='privada'?'🔒 Privada':'👨‍👩‍👧 Familiar'}</p>
                    </div>
                  </div>
                  <p style={{ fontWeight:700,fontSize:'.875rem' }}>{c.moneda==='USD'?'$':'RD$'} {fmtN(Number(c.balance||0))}</p>
                </div>
              ))
            }
          </div>

          {/* Préstamos */}
          {prestamos.length > 0 && (
            <>
              <p style={S.secTitle}>Préstamos pendientes</p>
              <div className="card" style={{ padding:0,overflow:'hidden' }}>
                {prestamos.map((p,i) => (
                  <div key={p.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.8rem 1rem',borderBottom:i<prestamos.length-1?'1px solid #F3F4F6':'none' }}>
                    <div>
                      <p style={{ fontWeight:600,fontSize:'.875rem' }}>{p.nombre}</p>
                      <p style={{ fontSize:'.72rem',color:'#9CA3AF' }}>{p.visibilidad==='privada'?'🔒 Privado':'👨‍👩‍👧 Familiar'}</p>
                    </div>
                    <p style={{ fontWeight:700,color:'#DC2626',fontSize:'.875rem' }}>RD$ {fmtN(Number(p.capital_pendiente))}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Comparativa mensual ──────────────────────────────────────────────── */}
      {tab === 'comparativa' && (
        <ComparativaMeses
          mesesDisp={mesesDisp}
          mesesSel={mesesSel}
          setMesesSel={setMesesSel}
          datosMeses={datosMeses}
          loading={loadingComp}
          drillMes={drillMes}
          setDrillMes={setDrillMes}
        />
      )}
    </div>
  )
}

function PatrimonioCard({ label, activos, deudas, bg, destacado }) {
  const neto = activos - deudas
  return (
    <div style={{ background:bg, color:'#fff', borderRadius:16, padding:'1rem 1.25rem', boxShadow: destacado?'0 6px 20px rgba(0,0,0,.25)':'0 3px 10px rgba(0,0,0,.15)' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
        <div>
          <p style={{ fontSize:'.78rem',opacity:.8,marginBottom:'.2rem' }}>{label}</p>
          <p style={{ fontSize: destacado?'1.5rem':'1.25rem', fontWeight:800 }}>RD$ {fmtN(Math.abs(neto))}</p>
          <p style={{ fontSize:'.72rem',opacity:.75,marginTop:'.15rem' }}>{neto>=0?'patrimonio positivo':'patrimonio negativo'}</p>
        </div>
        <div style={{ textAlign:'right',fontSize:'.75rem',opacity:.85 }}>
          <p>Activos: RD$ {fmtN(activos)}</p>
          <p>Deudas: RD$ {fmtN(deudas)}</p>
        </div>
      </div>
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

const fmtN = n => Number(n).toLocaleString('es-DO',{minimumFractionDigits:2})

// ── Comparativa mensual ────────────────────────────────────────────────────────
function ComparativaMeses({ mesesDisp, mesesSel, setMesesSel, datosMeses, loading, drillMes, setDrillMes }) {
  const ICONS = { 'Supermercado':'🛒','Combustible':'⛽','Educación':'📚','Salud':'🏥','Entretenimiento':'🎬','Servicios (agua/luz/internet)':'💡','Comidas Fuera de Casa':'🍽️','Suscripciones':'📱','Mesada Familiar':'👨‍👩‍👧','Préstamos':'🏦','Ahorros':'💰','Salidas':'🎉','Ropa':'👗','Hogar':'🏠','Vacaciones':'✈️','Mantenimiento Vehículo':'🚗' }

  // Datos de los meses seleccionados en orden cronológico
  const mesOrden   = [...mesesSel].sort()
  const maxTotal   = Math.max(...mesOrden.map(m => datosMeses[m]?.total || 0), 1)

  function toggleMes(m) {
    setMesesSel(prev =>
      prev.includes(m)
        ? prev.length > 1 ? prev.filter(x => x !== m) : prev // mínimo 1
        : [...prev, m]
    )
  }

  function exportCSV() {
    const header = ['Mes', 'Gastos RD$', 'Ingresos RD$', 'Ahorro RD$']
    const rows   = mesOrden.map(m => {
      const d = datosMeses[m] || {}
      return [
        format(new Date(m + '-15'), 'MMMM yyyy', { locale: es }),
        (d.total || 0).toFixed(2),
        (d.ingresos || 0).toFixed(2),
        ((d.ingresos || 0) - (d.total || 0)).toFixed(2),
      ]
    })
    const csv  = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `gastos-${mesOrden[0]}-${mesOrden[mesOrden.length-1]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // Drilldown: categorías de un mes específico
  if (drillMes) {
    const d    = datosMeses[drillMes] || {}
    const cats = Object.entries(d.categorias || {}).sort((a,b)=>b[1]-a[1])
    const maxC = cats[0]?.[1] || 1
    const label = format(new Date(drillMes + '-15'), 'MMMM yyyy', { locale: es })
    return (
      <div>
        <button onClick={() => setDrillMes(null)}
          style={{ display:'flex', alignItems:'center', gap:'.4rem', background:'none', border:'none',
            cursor:'pointer', color:'#2E6DA4', fontWeight:700, fontSize:'.875rem', marginBottom:'1rem', padding:0 }}>
          <ChevronLeft size={18}/> Volver
        </button>
        <h3 style={{ fontWeight:700, fontSize:'1rem', marginBottom:'.25rem', textTransform:'capitalize' }}>{label}</h3>
        <p style={{ fontSize:'.78rem', color:'#9CA3AF', marginBottom:'1rem' }}>
          Total: RD$ {fmtN(d.total || 0)} · {d.count || 0} gastos
        </p>
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {cats.length === 0
            ? <p style={{ padding:'2rem', textAlign:'center', color:'#9CA3AF' }}>Sin gastos este mes</p>
            : cats.map(([cat, tot], i) => (
              <div key={cat} style={{ padding:'.75rem 1rem',
                borderBottom: i < cats.length-1 ? '1px solid var(--color-border-secondary,#F3F4F6)' : 'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.3rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                    <span style={{ fontSize:'1.05rem' }}>{ICONS[cat]||'💸'}</span>
                    <span style={{ fontWeight:600, fontSize:'.875rem' }}>{cat}</span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontWeight:700, color:'#DC2626', fontSize:'.875rem' }}>RD$ {fmtN(tot)}</p>
                    <p style={{ fontSize:'.7rem', color:'#9CA3AF' }}>{d.total>0?((tot/d.total)*100).toFixed(0):0}%</p>
                  </div>
                </div>
                <div style={{ height:5, background:'var(--color-card-hover,#F3F4F6)', borderRadius:99 }}>
                  <div style={{ height:'100%', width:`${(tot/maxC)*100}%`, background:'#2E6DA4', borderRadius:99 }}/>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Selector de meses */}
      <div style={{ marginBottom:'1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.5rem' }}>
          <p style={{ fontSize:'.75rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.05em' }}>
            Selecciona los meses a comparar
          </p>
          <button onClick={exportCSV}
            style={{ display:'flex', alignItems:'center', gap:'.3rem', background:'none', border:'1px solid #E5E7EB',
              borderRadius:8, padding:'.3rem .6rem', cursor:'pointer', color:'#4B5563', fontSize:'.75rem', fontWeight:600 }}>
            <Download size={13}/> CSV
          </button>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem' }}>
          {mesesDisp.map(m => {
            const sel    = mesesSel.includes(m)
            const label  = format(new Date(m+'-15'), 'MMM yy', { locale: es })
            const tieneD = !!datosMeses[m]
            return (
              <button key={m} onClick={() => toggleMes(m)}
                style={{ padding:'.3rem .65rem', borderRadius:99, border:'1.5px solid', cursor:'pointer',
                  fontSize:'.75rem', fontWeight:700,
                  borderColor: sel ? '#2E6DA4' : '#E5E7EB',
                  background:  sel ? '#2E6DA4' : 'var(--color-card,#fff)',
                  color:       sel ? '#fff'    : '#6B7280',
                  opacity:     loading && !tieneD && sel ? .6 : 1,
                }}>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign:'center', padding:'1.5rem', color:'#9CA3AF', fontSize:'.875rem' }}>
          <div className="spinner" style={{ margin:'0 auto .75rem' }}/>
          Cargando datos históricos...
        </div>
      )}

      {/* Resumen comparativo */}
      {mesOrden.length >= 2 && !loading && (
        <div style={{ marginBottom:'1rem' }}>
          {(() => {
            const ultimo    = datosMeses[mesOrden[mesOrden.length-1]]?.total || 0
            const penultimo = datosMeses[mesOrden[mesOrden.length-2]]?.total || 0
            const delta     = ultimo - penultimo
            const pct       = penultimo > 0 ? (delta/penultimo)*100 : 0
            const mejoro    = delta <= 0
            return (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                background: mejoro?'#D4EDDA':'#FEE2E2', borderRadius:10, padding:'.7rem 1rem', marginBottom:'.75rem' }}>
                <p style={{ fontWeight:700, fontSize:'.875rem', color: mejoro?'#1B5E35':'#DC2626' }}>
                  {mejoro ? '📉 Mes más reciente menor' : '📈 Mes más reciente mayor'}
                </p>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontWeight:800, color: mejoro?'#1B5E35':'#DC2626' }}>
                    {delta>0?'+':''}RD$ {fmtN(Math.abs(delta))}
                  </p>
                  <p style={{ fontSize:'.72rem', color: mejoro?'#1B5E35':'#DC2626' }}>
                    {Math.abs(pct).toFixed(1)}% vs mes anterior
                  </p>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Gráfico de barras */}
      {mesOrden.length > 0 && (
        <div className="card" style={{ padding:'1rem', marginBottom:'1rem' }}>
          <p style={{ fontSize:'.72rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase',
            letterSpacing:'.05em', marginBottom:'.85rem' }}>
            Gastos mensuales — toca un mes para ver detalle
          </p>
          {/* Barras SVG — sin dependencias */}
          <div style={{ display:'flex', alignItems:'flex-end', gap: mesOrden.length > 6 ? '.3rem' : '.5rem', height:140, paddingBottom:'.1rem' }}>
            {mesOrden.map((m, i) => {
              const d       = datosMeses[m] || {}
              const gastoT  = d.total    || 0
              const ingresT = d.ingresos || 0
              const hG      = maxTotal > 0 ? Math.max((gastoT/maxTotal)*110, gastoT>0?6:0) : 0
              const hI      = maxTotal > 0 ? Math.max((ingresT/maxTotal)*110, ingresT>0?4:0) : 0
              const esMesAct = m === mes
              const label   = format(new Date(m+'-15'), mesOrden.length>6?'MMM':'MMM yy', { locale:es })
              return (
                <div key={m} onClick={() => setDrillMes(m)}
                  style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
                    gap:'.2rem', cursor:'pointer', minWidth:0 }}>
                  {/* Valor encima */}
                  {gastoT > 0 && (
                    <span style={{ fontSize:'.6rem', fontWeight:700, color:'#1E3A5F',
                      whiteSpace:'nowrap', overflow:'hidden', maxWidth:'100%', textOverflow:'ellipsis' }}>
                      {gastoT>=1000?`${(gastoT/1000).toFixed(0)}k`:`${Math.round(gastoT)}`}
                    </span>
                  )}
                  {/* Barras agrupadas (gasto + ingreso) */}
                  <div style={{ display:'flex', alignItems:'flex-end', gap:2, flex:1, width:'100%', justifyContent:'center' }}>
                    {/* Barra gasto */}
                    <div style={{ width:'45%', height:`${hG}px`, minHeight:gastoT>0?4:0,
                      background: esMesAct?'#DC2626':'#2E6DA4',
                      borderRadius:'4px 4px 0 0', transition:'height .3s ease',
                      opacity: esMesAct?1:.8 }}/>
                    {/* Barra ingreso (verde, más delgada) */}
                    {ingresT > 0 && (
                      <div style={{ width:'35%', height:`${hI}px`, minHeight:4,
                        background:'#1B5E35', borderRadius:'4px 4px 0 0',
                        transition:'height .3s ease', opacity:.75 }}/>
                    )}
                  </div>
                  {/* Label */}
                  <span style={{ fontSize:'.6rem', fontWeight: esMesAct?700:400, textTransform:'capitalize',
                    color: esMesAct?'#1E3A5F':'#9CA3AF', whiteSpace:'nowrap', textAlign:'center',
                    overflow:'hidden', maxWidth:'100%', textOverflow:'ellipsis' }}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
          {/* Leyenda */}
          <div style={{ display:'flex', gap:'1rem', marginTop:'.75rem', justifyContent:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'.3rem' }}>
              <div style={{ width:10, height:10, borderRadius:3, background:'#2E6DA4' }}/>
              <span style={{ fontSize:'.7rem', color:'#9CA3AF' }}>Gastos</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'.3rem' }}>
              <div style={{ width:10, height:10, borderRadius:3, background:'#1B5E35' }}/>
              <span style={{ fontSize:'.7rem', color:'#9CA3AF' }}>Ingresos familiares</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'.3rem' }}>
              <div style={{ width:10, height:10, borderRadius:3, background:'#DC2626' }}/>
              <span style={{ fontSize:'.7rem', color:'#9CA3AF' }}>Mes actual</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabla resumen */}
      {mesOrden.length > 0 && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr',
            background:'var(--color-card-hover,#F3F4F6)', padding:'.6rem .85rem',
            fontSize:'.7rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase' }}>
            <span>Mes</span><span style={{textAlign:'right'}}>Gastos</span>
            <span style={{textAlign:'right'}}>Ingresos</span><span style={{textAlign:'right'}}>Balance</span>
          </div>
          {mesOrden.map((m, i) => {
            const d       = datosMeses[m] || {}
            const gastoT  = d.total    || 0
            const ingresT = d.ingresos || 0
            const bal     = ingresT - gastoT
            const esMesAct = m === mes
            return (
              <div key={m} onClick={() => setDrillMes(m)}
                style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr',
                  padding:'.7rem .85rem', cursor:'pointer',
                  borderTop: '1px solid var(--color-border-secondary,#F3F4F6)',
                  background: esMesAct?'#EEF5FC':'transparent',
                  transition:'background .15s',
                }}>
                <span style={{ fontWeight: esMesAct?700:500, fontSize:'.82rem', textTransform:'capitalize',
                  color: esMesAct?'#2E6DA4':'var(--color-text,#1F2937)' }}>
                  {format(new Date(m+'-15'),'MMM yy',{locale:es})}
                  {esMesAct && <span style={{fontSize:'.65rem',color:'#2E6DA4',marginLeft:'.25rem'}}>●</span>}
                </span>
                <span style={{ textAlign:'right', fontWeight:600, fontSize:'.82rem', color:'#DC2626' }}>
                  {gastoT>0?`${(gastoT/1000).toFixed(1)}k`:'—'}
                </span>
                <span style={{ textAlign:'right', fontWeight:600, fontSize:'.82rem', color:'#1B5E35' }}>
                  {ingresT>0?`${(ingresT/1000).toFixed(1)}k`:'—'}
                </span>
                <span style={{ textAlign:'right', fontWeight:700, fontSize:'.82rem',
                  color: bal>=0?'#1B5E35':'#DC2626' }}>
                  {bal!==0?(bal>0?'+':'')+`${(bal/1000).toFixed(1)}k`:'—'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
const S = {
  tabs: { display:'flex',background:'var(--color-card-hover,#F3F4F6)',borderRadius:12,padding:'.25rem',marginBottom:'1rem',gap:'.25rem' },
  tab:  { flex:1,padding:'.55rem .4rem',borderRadius:9,border:'none',cursor:'pointer',fontSize:'.78rem',transition:'all .15s' },
  secTitle: { fontSize:'.75rem',fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.6rem',marginTop:'.25rem' },
  empty: { textAlign:'center',color:'#9CA3AF',padding:'3rem 1rem',fontSize:'1.5rem' },
}
