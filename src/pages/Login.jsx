import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/')
    } catch (err) {
      const map = {
        'auth/user-not-found': 'No existe una cuenta con ese correo.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
        'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
      }
      setError(map[err.code] || 'Error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem', background:'linear-gradient(135deg,#1E3A5F 0%,#2E6DA4 100%)' }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'2rem 1.75rem', width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.75rem' }}>
          <div style={{ background:'linear-gradient(135deg,#1E3A5F,#2E6DA4)', borderRadius:14, width:52, height:52, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ color:'#fff', fontWeight:800, fontSize:'1.1rem' }}>FF</span>
          </div>
          <div>
            <div style={{ fontSize:'1.3rem', fontWeight:700, color:'#1E3A5F' }}>FamilyFinance</div>
            <div style={{ fontSize:'.8rem', color:'#9CA3AF' }}>Gestión familiar inteligente</div>
          </div>
        </div>

        <h1 style={{ fontSize:'1.1rem', fontWeight:600, color:'#1F2937', marginBottom:'1.25rem' }}>Iniciar sesión</h1>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label">Correo electrónico</label>
            <input className="input" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <label className="label">Contraseña</label>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <div style={{ background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'.65rem .9rem', fontSize:'.875rem', marginBottom:'.75rem' }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ padding:'.85rem', marginTop:'.25rem' }}>
            {loading ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:'1rem' }}>
          <Link to="/reset-password" style={{ color:'#2E6DA4', fontSize:'.875rem', textDecoration:'none' }}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
    </div>
  )
}
