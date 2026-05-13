import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUsuarios, addUsuario } from '../services/sheets'
import { UserPlus, Shield, User } from 'lucide-react'

const COLORS = ['#2E6DA4','#1B5E35','#7A4800','#5B21B6','#BE185D','#0E7490']

export default function Usuarios() {
  const { isAdmin, perfil }   = useAuth()
  const [usuarios,  setUsuarios]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'miembro', avatar_color: COLORS[0] })

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setUsuarios(await getUsuarios())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await addUsuario(form)
      await load()
      setShowForm(false)
      setForm({ nombre: '', email: '', rol: 'miembro', avatar_color: COLORS[0] })
    } catch (e) {
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>
      Solo el administrador puede gestionar usuarios.
    </div>
  )

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700 }}>Usuarios familiares</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          <UserPlus size={16} /> Agregar
        </button>
      </div>

      {showForm && (
        <form className="card" style={{ marginBottom: '1rem' }} onSubmit={handleAdd}>
          <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Nuevo miembro</h3>

          <div className="field">
            <label className="label">Nombre completo</label>
            <input className="input" value={form.nombre} onChange={e => setForm(f=>({...f, nombre: e.target.value}))} required />
          </div>

          <div className="field">
            <label className="label">Correo (debe registrarse con este email)</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm(f=>({...f, email: e.target.value}))} required />
          </div>

          <div className="field">
            <label className="label">Rol</label>
            <select className="input" value={form.rol} onChange={e => setForm(f=>({...f, rol: e.target.value}))}>
              <option value="miembro">Miembro</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div className="field">
            <label className="label">Color de avatar</label>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              {COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setForm(f=>({...f, avatar_color: c}))}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', background: c,
                    border: form.avatar_color === c ? '3px solid #1F2937' : '2px solid #E5E7EB',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {error && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'.65rem', borderRadius:8, fontSize:'.875rem', marginBottom:'.75rem' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="spinner-center"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {usuarios.map(u => (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: u.avatar_color || '#2E6DA4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0,
              }}>
                {u.nombre?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600 }}>
                  {u.nombre}
                  {u.email === perfil?.email && <span style={{ fontSize: '.72rem', color: '#9CA3AF', marginLeft: '.5rem' }}>(tú)</span>}
                </p>
                <p style={{ fontSize: '.8rem', color: '#9CA3AF' }}>{u.email}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                {u.rol === 'admin'
                  ? <><Shield size={14} color="#7A4800" /><span style={{ fontSize: '.78rem', color: '#7A4800', fontWeight: 600 }}>Admin</span></>
                  : <><User size={14} color="#2E6DA4" /><span style={{ fontSize: '.78rem', color: '#2E6DA4', fontWeight: 600 }}>Miembro</span></>
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
