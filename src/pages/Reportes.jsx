import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getGastos, getIngresos, getCuentas, getSheet } from '../services/sheets'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'

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
        {[{k:'resumen',l:'📊 Resumen'},{k:'categorias',l:'🥧 Categorías'},{k:'patrimonio',l:'🏦 Patrimonio'}].map(t => (
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
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:'.6rem 1rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'.82rem', color:'#6B7280', fontWeight:600 }}>Total ingresos</span>
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
                  <div style={{ height:6,background:'#F3F4F6',borderRadius:99 }}>
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
                <div style={{ width:38,height:38,borderRadius:10,background:'#F3F4F6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0 }}>{ICONS[g.categoria]||'💸'}</div>
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
                      <div style={{ height:5,background:'#F3F4F6',borderRadius:99 }}>
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
const S = {
  tabs: { display:'flex',background:'#F3F4F6',borderRadius:12,padding:'.25rem',marginBottom:'1rem',gap:'.25rem' },
  tab:  { flex:1,padding:'.55rem .4rem',borderRadius:9,border:'none',cursor:'pointer',fontSize:'.78rem',transition:'all .15s' },
  secTitle: { fontSize:'.75rem',fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.6rem',marginTop:'.25rem' },
  empty: { textAlign:'center',color:'#9CA3AF',padding:'3rem 1rem',fontSize:'1.5rem' },
}
