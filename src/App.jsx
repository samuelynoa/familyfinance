import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PrefsProvider, usePrefs } from './context/PrefsContext'
import AppRoutes from './AppRoutes'
import PinLock from './pages/PinLock'
import './styles/global.css'

function AppWithPin() {
  const { pinEnabled, unlocked } = usePrefs()
  if (pinEnabled && !unlocked) return <PinLock/>
  return <AppRoutes/>
}

export default function App() {
  return (
    <BrowserRouter>
      <PrefsProvider>
        <AuthProvider>
          <AppWithPin/>
        </AuthProvider>
      </PrefsProvider>
    </BrowserRouter>
  )
}
