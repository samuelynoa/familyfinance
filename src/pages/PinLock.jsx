import { useState } from 'react'
import { usePrefs } from '../context/PrefsContext'
import { Lock, Delete } from 'lucide-react'

export default function PinLock() {
  const { verifyPin } = usePrefs()
  const [digits,  setDigits]  = useState([])
  const [error,   setError]   = useState('')
  const [shaking, setShaking] = useState(false)

  function press(d) {
    if (digits.length >= 4) return
    const next = [...digits, d]
    setDigits(next)
    setError('')
    if (next.length === 4) setTimeout(() => check(next.join('')), 150)
  }

  function del() { setDigits(d => d.slice(0,-1)); setError('') }

  function check(pin) {
    const ok = verifyPin(pin)
    if (!ok) {
      setShaking(true)
      setError('PIN incorrecto — intenta de nuevo')
      setDigits([])
      setTimeout(() => setShaking(false), 500)
    }
  }

  return (
    <div style={{ minHeight:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#1E3A5F,#2E6DA4)',padding:'2rem' }}>
      <div style={{ background:'#fff',borderRadius:24,padding:'2rem 1.75rem',width:'100%',maxWidth:320,textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,.3)',animation:shaking?'shake .4s ease':'none' }}>

        <div style={{ width:64,height:64,borderRadius:18,margin:'0 auto 1rem',background:'linear-gradient(135deg,#1E3A5F,#2E6DA4)',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <Lock size={28} color="#fff"/>
        </div>
        <h2 style={{ fontWeight:700,fontSize:'1.2rem',color:'#1F2937',marginBottom:'.25rem' }}>FamilyFinance</h2>
        <p style={{ color:'#9CA3AF',fontSize:'.875rem',marginBottom:'1.75rem' }}>Ingresa tu PIN para continuar</p>

        {/* Puntos */}
        <div style={{ display:'flex',justifyContent:'center',gap:'1rem',marginBottom:'1.75rem' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width:16,height:16,borderRadius:'50%',transition:'background .15s,transform .1s',background:i<digits.length?'#2E6DA4':'#E5E7EB',transform:i<digits.length?'scale(1.2)':'scale(1)' }}/>
          ))}
        </div>

        {error && <p style={{ color:'#DC2626',fontSize:'.82rem',marginBottom:'.75rem',fontWeight:600 }}>{error}</p>}

        {/* Teclado */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'.6rem' }}>
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <button key={d} onClick={() => press(String(d))} style={S.key}>{d}</button>
          ))}
          <div/>
          <button onClick={() => press('0')} style={S.key}>0</button>
          <button onClick={del} style={S.key}><Delete size={20}/></button>
        </div>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-8px)}80%{transform:translateX(8px)}}`}</style>
    </div>
  )
}

const S = { key:{ height:56,borderRadius:14,border:'1.5px solid #E5E7EB',background:'#F9FAFB',fontSize:'1.2rem',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' } }
