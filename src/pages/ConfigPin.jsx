import { useState } from 'react'
import { usePrefs } from '../context/PrefsContext'
import { Shield, ShieldOff, Check, Delete } from 'lucide-react'

export default function ConfigPin() {
  const { pinEnabled, setupPin, disablePin } = usePrefs()
  const [step,  setStep]  = useState('menu')   // menu | new | confirm
  const [pin1,  setPin1]  = useState([])
  const [pin2,  setPin2]  = useState([])
  const [error, setError] = useState('')
  const [msg,   setMsg]   = useState('')

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  function press(d, which) {
    const setter  = which===1 ? setPin1 : setPin2
    const current = which===1 ? pin1    : pin2
    if (current.length >= 4) return
    const next = [...current, d]
    setter(next)
    setError('')
    if (next.length === 4) {
      if (which===1) setTimeout(() => setStep('confirm'), 150)
      if (which===2) setTimeout(() => confirmPin(next), 150)
    }
  }

  function del(which) { (which===1?setPin1:setPin2)(d => d.slice(0,-1)) }

  function confirmPin(digits) {
    if (digits.join('') === pin1.join('')) {
      setupPin(pin1.join(''))
      setPin1([]); setPin2([])
      setStep('menu')
      flash('✓ PIN activado correctamente')
    } else {
      setError('Los PINs no coinciden — intenta de nuevo')
      setPin2([])
    }
  }

  if (step === 'new' || step === 'confirm') {
    const isConfirm = step === 'confirm'
    const digits    = isConfirm ? pin2 : pin1
    return (
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',padding:'2rem' }}>
        <div style={{ background:'#fff',borderRadius:20,padding:'2rem',width:'100%',maxWidth:300,textAlign:'center',boxShadow:'0 8px 30px rgba(0,0,0,.12)' }}>
          <h3 style={{ fontWeight:700,marginBottom:'.25rem' }}>{isConfirm?'Confirma tu PIN':'Elige un PIN de 4 dígitos'}</h3>
          <p style={{ color:'#9CA3AF',fontSize:'.82rem',marginBottom:'1.5rem' }}>
            {isConfirm?'Ingresa el mismo PIN de nuevo':'Este PIN protege el acceso a la app'}
          </p>
          <div style={{ display:'flex',justifyContent:'center',gap:'1rem',marginBottom:'1.5rem' }}>
            {[0,1,2,3].map(i => <div key={i} style={{ width:16,height:16,borderRadius:'50%',background:i<digits.length?'#2E6DA4':'#E5E7EB',transition:'background .15s,transform .1s',transform:i<digits.length?'scale(1.2)':'scale(1)' }}/>)}
          </div>
          {error && <p style={{ color:'#DC2626',fontSize:'.82rem',marginBottom:'.75rem',fontWeight:600 }}>{error}</p>}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'.5rem' }}>
            {[1,2,3,4,5,6,7,8,9].map(d => <button key={d} onClick={()=>press(String(d),isConfirm?2:1)} style={S.key}>{d}</button>)}
            <button onClick={()=>{setStep(isConfirm?'new':'menu');setPin1([]);setPin2([]);setError('')}} style={{ ...S.key,fontSize:'.7rem',fontWeight:600,color:'#9CA3AF' }}>Cancelar</button>
            <button onClick={()=>press('0',isConfirm?2:1)} style={S.key}>0</button>
            <button onClick={()=>del(isConfirm?2:1)} style={S.key}><Delete size={18}/></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontWeight:700,marginBottom:'1rem' }}>Seguridad</h2>

      {msg && <div style={{ display:'flex',alignItems:'center',gap:'.5rem',background:'#D4EDDA',color:'#1B5E35',padding:'.75rem 1rem',borderRadius:10,marginBottom:'1rem',fontWeight:600 }}><Check size={18}/>{msg}</div>}

      <div className="card" style={{ padding:'1.25rem' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div>
            <p style={{ fontWeight:700,fontSize:'.95rem' }}>PIN de acceso</p>
            <p style={{ fontSize:'.8rem',color:'#9CA3AF',marginTop:'.2rem' }}>
              {pinEnabled ? '✓ Activo — se pide al abrir la app' : 'Desactivado — la app abre sin PIN'}
            </p>
          </div>
          <button onClick={() => pinEnabled ? (disablePin(), flash('✓ PIN desactivado')) : setStep('new')}
            style={{ padding:'.55rem 1.1rem',borderRadius:10,border:'none',cursor:'pointer',fontWeight:700,fontSize:'.85rem',background:pinEnabled?'#FEE2E2':'#EEF5FC',color:pinEnabled?'#DC2626':'#2E6DA4' }}>
            {pinEnabled ? <><ShieldOff size={14} style={{marginRight:4,verticalAlign:'middle'}}/>Desactivar</> : <><Shield size={14} style={{marginRight:4,verticalAlign:'middle'}}/>Activar</>}
          </button>
        </div>
        {pinEnabled && (
          <div style={{ borderTop:'1px solid #F3F4F6',marginTop:'.85rem',paddingTop:'.85rem' }}>
            <button onClick={() => { setPin1([]); setPin2([]); setStep('new') }}
              style={{ background:'none',border:'none',color:'#2E6DA4',fontWeight:600,cursor:'pointer',fontSize:'.875rem' }}>
              Cambiar PIN
            </button>
          </div>
        )}
      </div>

      <p style={{ fontSize:'.78rem',color:'#9CA3AF',marginTop:'.75rem',lineHeight:1.5 }}>
        El PIN se guarda localmente en este dispositivo. Si desinstala la app o limpia el caché, el PIN se perderá.
      </p>
    </div>
  )
}

const S = { key:{ height:52,borderRadius:12,border:'1.5px solid #E5E7EB',background:'#F9FAFB',fontSize:'1.1rem',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' } }
