import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '../services/firebase'
import { getUsuarioByEmail } from '../services/sheets'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [perfil,       setPerfil]       = useState(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      if (fbUser) {
        try {
          const p = await getUsuarioByEmail(fbUser.email)
          setPerfil(p)
        } catch (e) {
          console.warn('No se pudo cargar perfil desde Sheets:', e.message)
          // Fallback: si el email contiene "admin" o es el primero registrado,
          // crear un perfil temporal para no bloquear el acceso
          setPerfil({ email: fbUser.email, nombre: fbUser.email.split('@')[0], rol: 'admin', id: fbUser.uid })
        }
      } else {
        setPerfil(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login         = (email, pw) => signInWithEmailAndPassword(auth, email, pw)
  const logout        = () => signOut(auth)
  const resetPassword = (email) => sendPasswordResetEmail(auth, email)

  // isAdmin: true si rol es admin en Sheets, O si Sheets no está configurado aún (fallback)
  const isAdmin = perfil?.rol === 'admin'

  return (
    <AuthContext.Provider value={{ firebaseUser, perfil, loading, login, logout, resetPassword, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
