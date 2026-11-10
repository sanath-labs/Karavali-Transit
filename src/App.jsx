import { useEffect, useState } from 'react'
import io from 'socket.io-client'
import { apiUrl, socketUrl } from './api.js'
import OfficialNavigation from './OfficialNavigation.jsx'
import PassengerPortal from './PassengerPortal.jsx'
import ConductorPortal from './ConductorPortal.jsx'
import OwnerPortal from './OwnerPortal.jsx'
import './App.css'

const socket = io(socketUrl)

function App() {
  const [role, setRole] = useState('passenger') // 'passenger' | 'conductor' | 'owner'
  const [passengerScreen, setPassengerScreen] = useState(1) // 1: Home, 2: Radar/Results, 3: Details, 4: Tracking
  const [preselectedStop, setPreselectedStop] = useState(null)
  const [activeModal, setActiveModal] = useState(null)

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

    const handleShiftBroadcast = (data) => {
      if (!data || !data.bus_id) return
      setLiveBuses((prev) => ({
        ...prev,
        [data.bus_id]: {
          ...(prev[data.bus_id] || {}),
          ...data,
          is_on_shift: true,
          tracking_status: data.tracking_status || 'NOT TRACKING',
        },
      }))
    }

    const handleTrackingStopped = ({ bus_id }) => {
      if (!bus_id) return
      setLiveBuses((prev) => ({
        ...prev,
        [bus_id]: {
          ...(prev[bus_id] || {}),
          tracking_status: 'OFFLINE',
          is_on_shift: false,
        },
      }))
    }

    socket.on('sync_buses', handleSyncBuses)
    socket.on('shift_broadcast', handleShiftBroadcast)
    socket.on('live_location_broadcast', handleLocationBroadcast)
    socket.on('bus_location_update', handleLocationBroadcast)
    socket.on('bus_tracking_stopped', handleTrackingStopped)

    return () => {
      socket.off('sync_buses', handleSyncBuses)
      socket.off('shift_broadcast', handleShiftBroadcast)
      socket.off('live_location_broadcast', handleLocationBroadcast)
      socket.off('bus_location_update', handleLocationBroadcast)
      socket.off('bus_tracking_stopped', handleTrackingStopped)
    }
  }, [])

  return (
    <main className="transit-app min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 select-none">
      {/* 1. UNIFIED OFFICIAL WEBSITE HEADER, ROUTE STRIP & HAMBURGER DRAWER */}
      <OfficialNavigation
        role={role}
        onSelectRole={(newRole) => {
          setRole(newRole)
          if (newRole === 'passenger') {
            setPassengerScreen(1)
          }
        }}
        lang={lang}
        toggleLanguage={toggleLanguage}
        dbStatus={dbStatus}
        onSelectCorridorStop={(stopName) => {
          setPreselectedStop(stopName)
          setRole('passenger')
          setPassengerScreen(1)
        }}
        onNavigateHome={() => {
          setRole('passenger')
          setPassengerScreen(1)
        }}
        onNavigateRadar={() => {
          setRole('passenger')
          setPassengerScreen(2)
        }}
        activeModal={activeModal}
        setActiveModal={setActiveModal}
      />

      {/* 2. MAIN PORTAL CONTENT */}
      <section className="app-content flex-1 flex flex-col bg-slate-50">
        {role === 'passenger' && (
          <PassengerPortal
            preselectedStop={preselectedStop}
            initialScreen={passengerScreen}
            lang={lang}
            onOpenFindStop={() => setActiveModal('findStop')}
            liveBuses={liveBuses}
            socket={socket}
          />
        )}

        {role === 'conductor' && (
          <ConductorPortal
            socket={socket}
            liveBuses={liveBuses}
            initialVehicleNumber={conductorVehicleInput}
            onExitToPassenger={() => {
              setRole('passenger')
              setPassengerScreen(1)
            }}
          />
        )}

        {role === 'owner' && (
          <OwnerPortal
            ownerEmail={ownerEmail}
            setOwnerEmail={setOwnerEmail}
            ownerAgencyName={ownerAgencyName}
            setOwnerAgencyName={setOwnerAgencyName}
            isOwnerAuthenticated={isOwnerAuthenticated}
            setIsOwnerAuthenticated={setIsOwnerAuthenticated}
            ownerToken={ownerToken}
            setOwnerToken={setOwnerToken}
            onExitToPassenger={() => {
              setRole('passenger')
              setPassengerScreen(1)
            }}
            onSwitchToConductor={(vehicleNumber, pin) => {
              setConductorVehicleInput(vehicleNumber)
              setConductorPinInput(pin)
              setRole('conductor')
            }}
          />
        )}
      </section>

      {/* 3. OFFICIAL WEBSITE FOOTER */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 px-4 sm:px-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800">Karavali-Transit</span>
            <span>•</span>
            <span>Mangaluru – Kundapura NH-66 Private Bus Network</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => {
                setRole('passenger')
                setPassengerScreen(1)
              }}
              className="hover:text-blue-600 cursor-pointer transition"
            >
              Passenger Home
            </button>
            <button
              type="button"
              onClick={() => setRole('owner')}
              className="hover:text-blue-600 cursor-pointer transition"
            >
              Fleet Owner
            </button>
            <button
              type="button"
              onClick={() => setRole('conductor')}
              className="hover:text-blue-600 cursor-pointer transition"
            >
              Conductor
            </button>
          </div>
        </div>
      </footer>
    </main>
  )
}

export default App
