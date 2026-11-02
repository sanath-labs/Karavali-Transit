import { useEffect, useState } from 'react'
import {
  Building,
  Bus,
  Radio,
} from 'lucide-react'
import io from 'socket.io-client'
import { translations } from './translations.js'
import { apiUrl, socketUrl } from './api.js'
import PassengerPortal from './PassengerPortal.jsx'
import ConductorPortal from './ConductorPortal.jsx'
import OwnerPortal from './OwnerPortal.jsx'
import './App.css'

const socket = io(socketUrl)

function App() {
  const [role, setRole] = useState('passenger') // 'passenger' | 'conductor' | 'owner'

  // BILINGUAL LOCALIZATION (English & Kannada / ಕನ್ನಡ)
  const [lang, setLang] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlLang = new URLSearchParams(window.location.search).get('lang')
        if (urlLang === 'kn' || urlLang === 'en') return urlLang
      }
      return localStorage.getItem('karavali_lang') || 'en'
    } catch {
      return 'en'
    }
  })

  const t = translations[lang] || translations.en

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'kn' : 'en'
    setLang(nextLang)
    try {
      localStorage.setItem('karavali_lang', nextLang)
    } catch {}
  }

  // Backend & System state
  const [dbStatus, setDbStatus] = useState(false)
  const [liveBuses, setLiveBuses] = useState({})

  // Conductor bus preset (passed from Fleet Owner switch action)
  const [conductorVehicleInput, setConductorVehicleInput] = useState('KA-19-AB-4509')
  const [, setConductorPinInput] = useState('')

  // Fleet Owner Session State (persisted across page reloads)
  const [ownerEmail, setOwnerEmail] = useState(() => {
    try {
      return localStorage.getItem('karavali_owner_email') || 'rakesh@gmail.com'
    } catch {
      return 'rakesh@gmail.com'
    }
  })
  const [ownerAgencyName, setOwnerAgencyName] = useState(() => {
    try {
      return localStorage.getItem('karavali_owner_agency') || 'Rakesh Shetty Travels'
    } catch {
      return 'Rakesh Shetty Travels'
    }
  })
  const [ownerToken, setOwnerToken] = useState(() => {
    try {
      return localStorage.getItem('karavali_owner_token') || ''
    } catch {
      return ''
    }
  })
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState(() => {
    try {
      return Boolean(localStorage.getItem('karavali_owner_token'))
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      if (ownerToken) {
        localStorage.setItem('karavali_owner_token', ownerToken)
        localStorage.setItem('karavali_owner_email', ownerEmail)
        localStorage.setItem('karavali_owner_agency', ownerAgencyName)
      } else {
        localStorage.removeItem('karavali_owner_token')
      }
    } catch (e) {
      console.warn('Could not persist owner session to localStorage:', e)
    }
  }, [ownerToken, ownerEmail, ownerAgencyName])

  // Check SQL database connection on mount
  useEffect(() => {
    fetch(apiUrl('/api/health'))
      .then((res) => res.json())
      .then((data) => setDbStatus(Boolean(data?.sql_connected || data?.database)))
      .catch(() => setDbStatus(false))
  }, [])

  // Listen for real-time WebSocket GPS coordinates
  useEffect(() => {
    const handleLocationBroadcast = (data) => {
      if (data.speed && data.speed > 100) return
      setLiveBuses((prev) => ({
        ...prev,
        [data.bus_id]: {
          ...(prev[data.bus_id] || {}),
          ...data,
        },
      }))
    }

    const handleSyncBuses = (buses) => {
      if (buses && typeof buses === 'object') {
        setLiveBuses((prev) => ({
          ...prev,
          ...buses,
        }))
      }
    }

    socket.on('sync_buses', handleSyncBuses)
    socket.on('live_location_broadcast', handleLocationBroadcast)
    socket.on('bus_location_update', handleLocationBroadcast)

    return () => {
      socket.off('sync_buses', handleSyncBuses)
      socket.off('live_location_broadcast', handleLocationBroadcast)
      socket.off('bus_location_update', handleLocationBroadcast)
    }
  }, [])

  return (
    <main className="transit-app min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {role === 'passenger' ? (
        <PassengerPortal
          lang={lang}
          toggleLanguage={toggleLanguage}
          onSelectRole={setRole}
          dbStatus={dbStatus}
        />
      ) : (
        <>
          {/* Official Government Topbar */}
          <div className="gov-topbar bg-slate-950 text-slate-300 text-xs px-6 py-2 border-b-2 border-blue-600">
            <div className="gov-topbar-content max-w-7xl mx-auto flex items-center justify-between">
              <span className="gov-title font-semibold tracking-wide">{t.govTitle}</span>
              <span className="gov-badge bg-white/10 px-2.5 py-0.5 rounded text-blue-300 text-xs font-semibold">{t.govBadge}</span>
            </div>
          </div>

          {/* Operational Header */}
          <header className="app-header bg-white border-b border-slate-200 px-6 py-3 shadow-xs flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="brand flex items-center gap-3 cursor-pointer" onClick={() => setRole('passenger')}>
              <span className="brand-icon w-11 h-11 rounded-xl bg-gradient-to-br from-blue-900 to-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
                <Bus size={22} aria-hidden="true" />
              </span>
              <div>
                <h1 className="app-title text-xl font-extrabold text-slate-900 tracking-tight m-0">{t.appTitle}</h1>
                <p className="brand-subtitle text-xs font-semibold text-slate-500 m-0">{t.brandSubtitle}</p>
              </div>
            </div>

            <div className="system-status-badge hidden lg:flex items-center gap-2 px-3.5 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-bold text-green-800">
              <span className="status-dot-green w-2 h-2 rounded-full bg-green-600 shadow-xs animate-pulse" />
              <span>{dbStatus ? t.dbConnected : t.gpsLive}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={toggleLanguage}
                className="lang-toggle-btn px-3 py-1.5 rounded-xl border border-slate-300 hover:border-blue-600 bg-white hover:bg-blue-50 text-slate-800 font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                title={lang === 'en' ? 'ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಿ' : 'Switch to English'}
              >
                <span className="text-sm">🌐</span>
                <span>{t.langToggle}</span>
              </button>

              <nav className="role-switch flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1" aria-label="Switch User Mode">
                <button
                  type="button"
                  onClick={() => setRole('passenger')}
                  className={`role-button px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    role === 'passenger' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Bus size={15} />
                  <span>{t.passengerRadar}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('conductor')}
                  className={`role-button px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    role === 'conductor' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Radio size={15} />
                  <span>{t.conductorTerminal}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  className={`role-button px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    role === 'owner' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building size={15} />
                  <span>{t.fleetOwner}</span>
                </button>
              </nav>
            </div>
          </header>

          <section className="app-content flex-1 flex flex-col">
            {role === 'conductor' ? (
              <ConductorPortal
                socket={socket}
                liveBuses={liveBuses}
                initialVehicleNumber={conductorVehicleInput}
                onExitToPassenger={() => setRole('passenger')}
              />
            ) : (
              <OwnerPortal
                ownerEmail={ownerEmail}
                setOwnerEmail={setOwnerEmail}
                ownerAgencyName={ownerAgencyName}
                setOwnerAgencyName={setOwnerAgencyName}
                isOwnerAuthenticated={isOwnerAuthenticated}
                setIsOwnerAuthenticated={setIsOwnerAuthenticated}
                ownerToken={ownerToken}
                setOwnerToken={setOwnerToken}
                onExitToPassenger={() => setRole('passenger')}
                onSwitchToConductor={(vehicleNumber, pin) => {
                  setConductorVehicleInput(vehicleNumber)
                  setConductorPinInput(pin)
                  setRole('conductor')
                }}
              />
            )}
          </section>
        </>
      )}
    </main>
  )
}

export default App
