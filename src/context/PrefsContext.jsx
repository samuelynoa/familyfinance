import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext(null)
const BIOMETRIC_BYPASS = '__biometric__bypass__'

const DEFAULTS = { pinEnabled: false, pinHash: '', hideBalances: true, theme: 'system' }

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ff_prefs') || '{}') } }
  catch { return DEFAULTS }
}
function save(p) { try { localStorage.setItem('ff_prefs', JSON.stringify(p)) } catch {} }
function hashPin(pin) {
  let h = 0
  for (let i = 0; i < pin.length; i++) h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0
  return String(h)
}

export function PrefsProvider({ children }) {
  const [prefs,    setPrefs]    = useState(load)
  const [unlocked, setUnlocked] = useState(false)

  // Aplica data-theme al <html> cada vez que cambia el tema
  useEffect(() => {
    function apply() {
      let dark = false
      if (prefs.theme === 'dark')   dark = true
      else if (prefs.theme === 'light') dark = false
      else dark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    apply()
    // Escuchar cambios del sistema solo si theme === 'system'
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    if (prefs.theme === 'system') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [prefs.theme])

  function update(changes) {
    const next = { ...prefs, ...changes }
    setPrefs(next)
    save(next)
  }

  const toggleHideBalances = () => update({ hideBalances: !prefs.hideBalances })
  const setTheme           = (t) => update({ theme: t })
  const setupPin   = (pin) => { update({ pinEnabled: true,  pinHash: hashPin(pin) }); setUnlocked(true) }
  const disablePin = ()    => { update({ pinEnabled: false, pinHash: '' });             setUnlocked(true) }

  function verifyPin(pin) {
    const ok = pin === BIOMETRIC_BYPASS || hashPin(pin) === prefs.pinHash
    if (ok) setUnlocked(true)
    return ok
  }

  return (
    <Ctx.Provider value={{
      prefs, unlocked,
      pinEnabled:          prefs.pinEnabled,
      hideBalances:        prefs.hideBalances,
      theme:               prefs.theme,
      toggleHideBalances,  setTheme,
      setupPin, disablePin, verifyPin,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePrefs() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePrefs must be used within PrefsProvider')
  return ctx
}
