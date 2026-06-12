import { useState } from 'react'
import { usePrefs } from '../context/PrefsContext'
import { Shield, ShieldOff, Check, Delete, Sun, Moon, Monitor, Eye, EyeOff } from 'lucide-react'

export default function ConfigSeguridad() {
  const { pinEnabled, setupPin, disablePin,
          theme, setTheme, hideBalances, toggleHideBalances } = usePrefs()
  const [step,  setStep]  = useState('menu')
  const [pin1,  setPin1]  = useState([])
  const [pin2,  setPin2]  = useState([])
  const [error, setError] = useState('')
  const [msg,   setMsg]   = useState('')

  function flash(m) { setMsg(m); setTimeout(()=>setMsg(''),2500) }

  function press(d,which) {
    const setter  = which===1?setPin1:setPin2
    const current = which===1?pin1:pin2
    if (current.length>=4) return
    const next=[...current,d]; setter(next); setError('')
    if (next.length===4) {
      if (which===1) setTimeout(()=>setStep('confirm'),150)
      if (which===2) setTimeout(()=>confirmPin(next),150)
    }
  }
  function del(w) { (w===1?setPin1:setPin2)(d=>d.slice(0,-1)) }
  function confirmPin(digits) {
    if (digits.join('')===pin1.join('')) {
      setupPin(pin1.join('')); setPin1([]); setPin2([])
      setStep('menu'); flash('✓ PIN activado')
    } else { setError('Los PINs no coinciden'); setPin2([]) }
  }

  if (step==='new'||step==='confirm') {
    const isCon=step==='confirm'; const digits=isCon?pin2:pin1
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'55vh',padding:'2rem'}}>
        <div className="card" style={{padding:'2rem',width:'100%',maxWidth:300,textAlign:'center'}}>
          <h3 style={{fontWeight:700,marginBottom:'.25rem'}}>{isCon?'Confirma tu PIN':'PIN de 4 dígitos'}</h3>
          <p style={{color:'#9CA3AF',fontSize:'.82rem',marginBottom:'1.5rem'}}>{isCon?'Ingresa el mismo PIN de nuevo':'Protege el acceso a la app'}</p>
          <div style={{display:'flex',justifyContent:'center',gap:'1rem',marginBottom:'1.5rem'}}>
            {[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:'50%',background:i<digits.length?'#2E6DA4':'#E5E7EB',transition:'background .15s,transform .1s',transform:i<digits.length?'scale(1.2)':'scale(1)'}}/>)}
          </div>
          {error&&<p style={{color:'#DC2626',fontSize:'.82rem',marginBottom:'.75rem',fontWeight:600}}>{error}</p>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'.5rem'}}>
            {[1,2,3,4,5,6,7,8,9].map(d=><button key={d} onClick={()=>press(String(d),isCon?2:1)} style={S.key}>{d}</button>)}
            <button onClick={()=>{setStep(isCon?'new':'menu');setPin1([]);setPin2([]);setError('')}} style={{...S.key,fontSize:'.7rem',color:'#9CA3AF'}}>Cancelar</button>
            <button onClick={()=>press('0',isCon?2:1)} style={S.key}>0</button>
            <button onClick={()=>del(isCon?2:1)} style={S.key}><Delete size={18}/></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{fontWeight:700,marginBottom:'1rem'}}>Seguridad y apariencia</h2>

      {msg&&<div style={{display:'flex',alignItems:'center',gap:'.5rem',background:'#D4EDDA',color:'#1B5E35',padding:'.75rem 1rem',borderRadius:10,marginBottom:'1rem',fontWeight:600}}><Check size={18}/>{msg}</div>}

      {/* PIN */}
      <div className="card" style={{padding:'1.25rem',marginBottom:'.75rem'}}>
        <p style={S.secLabel}>🔐 Bloqueo de pantalla</p>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <p style={{fontWeight:600,fontSize:'.95rem'}}>PIN + Biométrico</p>
            <p style={{fontSize:'.8rem',color:'#9CA3AF',marginTop:'.2rem'}}>{pinEnabled?'✓ Activo — pide PIN o huella al abrir':'Desactivado'}</p>
          </div>
          <button onClick={()=>pinEnabled?(disablePin(),flash('✓ PIN desactivado')):setStep('new')}
            style={{padding:'.55rem 1.1rem',borderRadius:10,border:'none',cursor:'pointer',fontWeight:700,fontSize:'.85rem',background:pinEnabled?'#FEE2E2':'#EEF5FC',color:pinEnabled?'#DC2626':'#2E6DA4'}}>
            {pinEnabled?<><ShieldOff size={14} style={{marginRight:4,verticalAlign:'middle'}}/>Desactivar</>:<><Shield size={14} style={{marginRight:4,verticalAlign:'middle'}}/>Activar</>}
          </button>
        </div>
        {pinEnabled&&<div style={{borderTop:'1px solid var(--color-border-secondary,#F3F4F6)',marginTop:'.85rem',paddingTop:'.85rem'}}>
          <button onClick={()=>{setPin1([]);setPin2([]);setStep('new')}} style={{background:'none',border:'none',color:'#2E6DA4',fontWeight:600,cursor:'pointer',fontSize:'.875rem'}}>Cambiar PIN</button>
        </div>}
      </div>

      {/* Tema */}
      <div className="card" style={{padding:'1.25rem',marginBottom:'.75rem'}}>
        <p style={S.secLabel}>🎨 Tema de la app</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'.6rem',marginTop:'.5rem'}}>
          {[{v:'light',l:'Claro',icon:<Sun size={18}/>},{v:'dark',l:'Oscuro',icon:<Moon size={18}/>},{v:'system',l:'Auto',icon:<Monitor size={18}/>}].map(({v,l,icon})=>(
            <button key={v} onClick={()=>{setTheme(v);flash(`✓ Tema ${l}`)}}
              style={{padding:'.75rem .5rem',borderRadius:12,border:'1.5px solid',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'.4rem',fontSize:'.82rem',
                fontWeight:theme===v?700:500,borderColor:theme===v?'#2E6DA4':'#E5E7EB',background:theme===v?'#EEF5FC':'transparent',color:theme===v?'#2E6DA4':'#6B7280'}}>
              {icon}{l}
            </button>
          ))}
        </div>
        <p style={{fontSize:'.75rem',color:'#9CA3AF',marginTop:'.6rem'}}>
          "Auto" sigue la configuración del sistema operativo
        </p>
      </div>

      {/* Ocultar balances */}
      <div className="card" style={{padding:'1.25rem'}}>
        <p style={S.secLabel}>👁️ Privacidad</p>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <p style={{fontWeight:600,fontSize:'.95rem'}}>Ocultar balances al abrir</p>
            <p style={{fontSize:'.8rem',color:'#9CA3AF',marginTop:'.2rem'}}>
              {hideBalances?'Balances ocultos por defecto':'Balances visibles por defecto'}
            </p>
          </div>
          <button onClick={()=>{toggleHideBalances();flash('✓ Preferencia guardada')}}
            style={{width:52,height:28,borderRadius:99,border:'none',cursor:'pointer',background:hideBalances?'#2E6DA4':'#D1D5DB',position:'relative',transition:'background .2s'}}>
            <div style={{position:'absolute',top:3,width:22,height:22,borderRadius:'50%',background:'var(--color-card,#fff)',transition:'left .2s',left:hideBalances?'26px':'4px',boxShadow:'0 1px 4px rgba(0,0,0,.2)'}}/>
          </button>
        </div>
        <p style={{fontSize:'.75rem',color:'#9CA3AF',marginTop:'.5rem'}}>
          El ícono {hideBalances?<EyeOff size={11} style={{verticalAlign:'middle'}}/>:<Eye size={11} style={{verticalAlign:'middle'}}/>} en el header siempre permite cambiarlo al momento
        </p>
      </div>
    </div>
  )
}

const S = {
  secLabel: {fontSize:'.72rem',fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.6rem'},
  key: {height:52,borderRadius:12,border:'1.5px solid var(--color-border,#E5E7EB)',background:'var(--color-card-hover,#F9FAFB)',fontSize:'1.1rem',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
}
