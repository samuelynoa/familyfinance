import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '../services/firebase'
import { getUsuarioByEmail } from '../services/sheets'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [perfil,       setPerfil]       = useState(null)   // fila en hoja usuarios
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      if (fbUser) {
        try {
          const p = await getUsuarioByEmail(fbUser.email)
          setPerfil(p)
        } catch {
          setPerfil(null)
        }
      } else {
        setPerfil(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const logout = () => signOut(auth)

  const resetPassword = (email) => sendPasswordResetEmail(auth, email)

  const isAdmin = perfil?.rol === 'admin'

  return (
    <AuthContext.Provider value={{
      firebaseUser, perfil, loading, login, logout, resetPassword, isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
