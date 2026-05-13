import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ResetPassword() {
  const { resetPassword } = useAuth()
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch {
      setError('No se pudo enviar el correo. Verifica la dirección.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <Link to="/login" style={styles.back}>
          <ArrowLeft size={16} /> Volver
        </Link>

        <div style={styles.iconWrap}><Mail size={32} color="#2E6DA4" /></div>
        <h1 style={styles.title}>Recuperar contraseña</h1>

        {sent ? (
          <div style={styles.success}>
            ✓ Revisa tu correo. Te enviamos el enlace para restablecer tu contraseña.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label">Correo electrónico</label>
              <input
                className="input"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button
              className="btn btn-primary btn-full"
              disabled={loading}
              style={{ marginTop: '.5rem' }}
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100dvh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '1.5rem',
    background: 'linear-gradient(135deg, #1E3A5F 0%, #2E6DA4 100%)',
  },
  card: {
    background: '#fff', borderRadius: 20, padding: '2rem 1.75rem',
    width: '100%', maxWidth: 380,
  },
  back: {
    display: 'inline-flex', alignItems: 'center', gap: '.35rem',
    color: '#2E6DA4', fontSize: '.875rem', textDecoration: 'none',
    marginBottom: '1.5rem',
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 16,
    background: '#EEF5FC', display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto 1rem',
  },
  title: { fontSize: '1.1rem', fontWeight: 600, color: '#1F2937', textAlign: 'center', marginBottom: '1.25rem' },
  success: {
    background: '#D4EDDA', color: '#1B5E35', borderRadius: 8,
    padding: '.85rem 1rem', fontSize: '.9rem', textAlign: 'center',
  },
  error: {
    background: '#FEE2E2', color: '#DC2626', borderRadius: 8,
    padding: '.65rem .9rem', fontSize: '.875rem', marginBottom: '.75rem',
  },
}
