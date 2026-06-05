// Maneja PIN + preferencias — todo en localStorage
import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext(null)

const DEFAULTS = { pinEnabled: false, pinHash: '' }

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ff_prefs') || '{}') } }
  catch { return DEFAULTS }
}
function save(p) {
  try { localStorage.setItem('ff_prefs', JSON.stringify(p)) } catch {}
}
function hash(pin) {
  let h = 0
  for (let i = 0; i < pin.length; i++) h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0
  return String(h)
}

export function PrefsProvider({ children }) {
  const [prefs,    setPrefs]    = useState(load)
  const [unlocked, setUnlocked] = useState(false)

  function update(changes) {
    const next = { ...prefs, ...changes }
    setPrefs(next)
    save(next)
  }

  const setupPin  = (pin) => { update({ pinEnabled: true, pinHash: hash(pin) }); setUnlocked(true) }
  const disablePin = ()   => { update({ pinEnabled: false, pinHash: '' });        setUnlocked(true) }
  const verifyPin = (pin) => {
    const ok = hash(pin) === prefs.pinHash
    if (ok) setUnlocked(true)
    return ok
  }

  return (
    <Ctx.Provider value={{ prefs, unlocked, pinEnabled: prefs.pinEnabled, setupPin, disablePin, verifyPin }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePrefs() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePrefs must be used within PrefsProvider')
  return ctx
}
