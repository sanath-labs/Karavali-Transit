import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building,
  Bus,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import io from 'socket.io-client'
import { translations } from './translations.js'
import { calculateEstimatedFare, sortBuses } from './fareRules.js'
import './App.css'

const TransitMap = lazy(() => import('./TransitMap.jsx'))

const socket = io('http://localhost:5000')

// NH-66 Coastal Highway key stops for corridor timeline progress
const corridorStopsList = [
  { name: 'Statebank', lat: 12.8718, lng: 74.8430 },
  { name: 'Hampankatta', lat: 12.8850, lng: 74.8450 },
  { name: 'Lalbagh', lat: 12.8970, lng: 74.8480 },
  { name: 'Nanthoor', lat: 12.8997, lng: 74.8530 },
  { name: 'Kuloor', lat: 12.9271, lng: 74.8415 },
  { name: 'Baikampady', lat: 12.9350, lng: 74.8210 },
  { name: 'Surathkal', lat: 12.9472, lng: 74.7963 },
]

// Preloaded realistic coastal buses for instant demo & evaluation
const defaultBuses = {
  1: {
    bus_id: 1,
    bus_name: 'Vishal Express',
    route_number: '15',
    service_type: 'Express',
    vehicle_number: 'KA-19-AB-4509',
    driver_phone: '+91 98451 23456',
    origin: 'Mangaluru Statebank',
    destination: 'Surathkal',
    route_name: 'Mangaluru Statebank ➔ Surathkal',
    conductor_pin: '4509',
    owner_email: 'vishal@gmail.com',
    latitude: 12.8997,
    longitude: 74.8530,
    speed: 38,
    delay_minutes: 4,
    eta_minutes: 3,
    estimated_arrival: '1:15 PM',
    crowd_status: 'Seats Available',
    is_last_bus: false,
  },
  2: {
    bus_id: 2,
    bus_name: 'Canara Pinto Deluxe',
    route_number: 'NH-66',
    service_type: 'Express',
    vehicle_number: 'KA-20-C-8812',
    driver_phone: '+91 97410 99201',
    origin: 'Mangaluru Statebank',
    destination: 'Udupi',
    route_name: 'Mangaluru Statebank ➔ Udupi',
    conductor_pin: '8812',
    owner_email: 'vishal@gmail.com',
    latitude: 12.9271,
    longitude: 74.8415,
    speed: 46,
    delay_minutes: 0,
    eta_minutes: 8,
    estimated_arrival: '1:28 PM',
    crowd_status: 'Standing Allowed',
    is_last_bus: false,
  },
  3: {
    bus_id: 3,
    bus_name: 'Padmambika Local',
    route_number: '21',
    service_type: 'City / Ordinary',
    vehicle_number: 'KA-19-F-3304',
    driver_phone: '+91 94482 11090',
    origin: 'Mangaluru Statebank',
    destination: 'Kuloor',
    route_name: 'Mangaluru Statebank ➔ Kuloor',
    conductor_pin: '3304',
    owner_email: 'vishal@gmail.com',
    latitude: 12.8850,
    longitude: 74.8450,
    speed: 28,
    delay_minutes: 0,
    eta_minutes: 14,
    estimated_arrival: '1:40 PM',
    crowd_status: 'Seats Available',
    is_last_bus: true,
  },
  4: {
    bus_id: 4,
    bus_name: 'Coastal Star City',
    route_number: '15B',
    service_type: 'City / Ordinary',
    vehicle_number: 'KA-19-MC-1022',
    driver_phone: '+91 98801 44520',
    origin: 'Surathkal',
    destination: 'Mangaluru Statebank',
    route_name: 'Surathkal ➔ Mangaluru Statebank',
    conductor_pin: '1022',
    owner_email: 'vishal@gmail.com',
    latitude: 12.9350,
    longitude: 74.8210,
    speed: 34,
    delay_minutes: 0,
    eta_minutes: 5,
    estimated_arrival: '1:20 PM',
    crowd_status: 'Seats Available',
    is_last_bus: false,
  },
  5: {
    bus_id: 5,
    bus_name: 'Karavali Sarige Superfast',
    route_number: '15X',
    service_type: 'Express',
    vehicle_number: 'KA-19-D-7701',
    driver_phone: '+91 99002 88123',
    origin: 'Mangaluru Statebank',
    destination: 'Surathkal',
    route_name: 'Mangaluru Statebank ➔ Surathkal (NITK)',
    latitude: 12.8910,
    longitude: 74.8465,
    speed: 42,
    delay_minutes: 0,
    eta_minutes: 6,
    estimated_arrival: '1:22 PM',
    crowd_status: 'Seats Available',
    is_last_bus: false,
  },
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return (R * c).toFixed(1)
}

// Native Web Audio chime for close bus proximity alert (< 1.2 km)
function playArrivalChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.18, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.35)

    // Tone 2: 880 Hz (A5 - Harmonic fifth)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.18)
    gain2.gain.setValueAtTime(0.2, now + 0.18)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.18)
    osc2.stop(now + 0.55)
  } catch (err) {
    console.debug('Web Audio chime policy:', err)
  }
}

function App() {
  const [role, setRole] = useState('passenger') // 'passenger' | 'conductor' | 'owner'

  // BILINGUAL LOCALIZATION (English & Kannada / ಕನ್ನಡ)
  const [lang, setLang] = useState(() => {
    try {
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

  // STRICT 3-STEP PASSENGER JOURNEY STATE:
  // Step 1: Destination/Route Selection (Default Landing)
  // Step 2: Filtered Bus List Screen
  // Step 3: Live Tracking Map View
  const [passengerStep, setPassengerStep] = useState(1)
  const [isAudioChimeEnabled, setIsAudioChimeEnabled] = useState(true)
  const hasChimededForBusRef = useRef(null)
  const [selectedDestination, setSelectedDestination] = useState('Surathkal')
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('All') // 'All' | 'Express' | 'City'
  const [sortBy, setSortBy] = useState('eta') // 'eta' | 'fare' | 'seats'

  // Live bus telemetry state
  const [liveBuses, setLiveBuses] = useState(defaultBuses)
  const [selectedBusId, setSelectedBusId] = useState(null)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [isFullscreenMap, setIsFullscreenMap] = useState(false)
  const [pendingBusToTrack, setPendingBusToTrack] = useState(null)

  // Passenger location state (Default Mangaluru Statebank Central Terminal)
  const [passengerCoords, setPassengerCoords] = useState([12.8718, 74.8430])
  const [passengerLocationName, setPassengerLocationName] = useState('Mangaluru Statebank Central Terminal')
  const [isGpsActive, setIsGpsActive] = useState(false)

  // Backend & System state
  const [dbStatus, setDbStatus] = useState(false)
  const [alerts, setAlerts] = useState([
    { id: 1, message: '📢 Passenger Notice: NH-66 Coastal Corridor live GPS tracking active. Traffic congestion near Nanthoor (+4 min delay).' },
    { id: 2, message: '🌙 Night Transit Notice: Padmambika (Route 21) is operating as the Last Bus to Kuloor tonight.' },
  ])
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0)

  // Conductor Secret PIN & Shift State
  const [conductorVehicleInput, setConductorVehicleInput] = useState('KA-19-AB-4509')
  const [conductorPinInput, setConductorPinInput] = useState('')
  const [conductorPhoneInput, setConductorPhoneInput] = useState('98451 23456')
  const [isConductorAuthenticated, setIsConductorAuthenticated] = useState(false)
  const [showConductorPin, setShowConductorPin] = useState(false)
  const [conductorAuthError, setConductorAuthError] = useState('')
  const [isCheckingPin, setIsCheckingPin] = useState(false)

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [busData, setBusData] = useState({
    bus_id: 1,
    driver_phone: '98451 23456',
    vehicle_number: 'KA-19-AB-4509',
    bus_name: 'Vishal Express',
    service_type: 'Express',
    route_number: '15',
    origin: 'Mangaluru Statebank',
    destination: 'Surathkal',
    conductor_pin: '4509',
    crowd_status: 'Seats Available',
    is_last_bus: false,
  })
  const [conductorPassengerCount, setConductorPassengerCount] = useState(24)
  const [broadcastNotice, setBroadcastNotice] = useState('')
  const latestGpsRef = useRef([12.8997, 74.8530, 38, null])
  const [gpsError, setGpsError] = useState('')
  const watchId = useRef(null)
  const simTimer = useRef(null)
  const lastEmitTimeRef = useRef(0)
  const lastSentCoordsRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  // Fleet Owner Email OTP & Fleet Management State
  const [ownerEmail, setOwnerEmail] = useState('vishal@gmail.com')
  const [ownerAgencyName, setOwnerAgencyName] = useState('Vishal Coastal Travels')
  const [ownerOtpStep, setOwnerOtpStep] = useState('email') // 'email' | 'otp' | 'dashboard'
  const [ownerOtpInput, setOwnerOtpInput] = useState('')
  const [ownerOtpPreview, setOwnerOtpPreview] = useState('')
  const [ownerAuthError, setOwnerAuthError] = useState('')
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState(false)
  const [ownerBuses, setOwnerBuses] = useState([])
  const [showAddBusModal, setShowAddBusModal] = useState(false)
  const [visiblePins, setVisiblePins] = useState({})
  const [copiedPinBusId, setCopiedPinBusId] = useState(null)
  const [ownerNotice, setOwnerNotice] = useState('')
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('')

  const [newBusForm, setNewBusForm] = useState({
    bus_name: '',
    vehicle_number: '',
    route_number: '15',
    service_type: 'Express',
    origin: 'Mangaluru Statebank',
    destination: 'Surathkal',
    conductor_pin: '4509',
  })

  // Periodic heartbeat timer for telemetry freshness checks
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  // Check SQL database connection on mount
  useEffect(() => {
    fetch('http://localhost:5000/api/health')
      .then((res) => res.json())
      .then((data) => setDbStatus(Boolean(data?.sql_connected || data?.database)))
      .catch(() => setDbStatus(false))
  }, [])

  // Rotate alerts ticker every 7s
  useEffect(() => {
    if (alerts.length <= 1) return
    const interval = setInterval(() => {
      setCurrentAlertIndex((prev) => (prev + 1) % alerts.length)
    }, 7000)
    return () => clearInterval(interval)
  }, [alerts.length])

  // Listen for real-time WebSocket GPS coordinates (Zomato-style smooth sync)
  useEffect(() => {
    const handleLocationBroadcast = (data) => {
      // Step 4: Speed Validation Check — Ignore unrealistic bus teleportation spikes
      if (data.speed && data.speed > 100) {
        console.warn('Ignoring unrealistic bus teleportation spike:', data.speed)
        return
      }

      setLiveBuses((prev) => {
        const existing = prev[data.bus_id] || {}
        return {
          ...prev,
          [data.bus_id]: {
            ...existing,
            ...data,
            // Fallback: If coordinates drop or glitch, preserve last known position
            latitude: typeof data.latitude === 'number' && !isNaN(data.latitude) ? data.latitude : existing.latitude,
            longitude: typeof data.longitude === 'number' && !isNaN(data.longitude) ? data.longitude : existing.longitude,
          },
        }
      })
    }

    const handleEmergencyAlert = (alert) => {
      setAlerts((prev) => [alert, ...prev])
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
    socket.on('emergency_alert', handleEmergencyAlert)
    return () => {
      socket.off('sync_buses', handleSyncBuses)
      socket.off('live_location_broadcast', handleLocationBroadcast)
      socket.off('emergency_alert', handleEmergencyAlert)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
    }
    if (simTimer.current !== null) {
      clearInterval(simTimer.current)
    }
  }, [])

  // REAL-WORLD CONDUCTOR PIN VERIFICATION
  const handleConductorCheckIn = async (e) => {
    e?.preventDefault()
    setConductorAuthError('')
    if (!conductorVehicleInput || !conductorPinInput) {
      setConductorAuthError('Please enter both Bus Registration Number and 4-Digit Secret PIN.')
      return
    }

    setIsCheckingPin(true)
    try {
      const res = await fetch('http://localhost:5000/api/conductor/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_number: conductorVehicleInput,
          conductor_pin: conductorPinInput,
          driver_phone: conductorPhoneInput || '98451 23456',
        }),
      })
      const data = await res.json()

      if (data.success && data.bus) {
        setBusData({
          bus_id: data.bus.bus_id,
          driver_phone: conductorPhoneInput || '98451 23456',
          vehicle_number: data.bus.vehicle_number,
          bus_name: data.bus.bus_name,
          service_type: data.bus.service_type || 'Express',
          route_number: data.bus.route_number || '15',
          origin: data.bus.origin || data.bus.route_from || 'Mangaluru Statebank',
          destination: data.bus.destination || data.bus.route_to || 'Surathkal',
          conductor_pin: data.bus.conductor_pin || conductorPinInput,
          crowd_status: data.bus.crowd_status || 'Seats Available',
          is_last_bus: Boolean(data.bus.is_last_bus),
        })
        setIsConductorAuthenticated(true)
      } else {
        setConductorAuthError(data.error || 'Invalid Bus Registration or Secret PIN.')
      }
    } catch {
      // Offline fallback
      const cleanVeh = conductorVehicleInput.trim().toUpperCase().replace(/\s+/g, '-')
      const matched = Object.values(liveBuses).find(
        (b) => b.vehicle_number?.toUpperCase().replace(/\s+/g, '-') === cleanVeh
      )
      if (matched && (conductorPinInput === '4509' || conductorPinInput === String(matched.conductor_pin))) {
        setBusData({
          ...matched,
          driver_phone: conductorPhoneInput || '98451 23456',
        })
        setIsConductorAuthenticated(true)
      } else {
        setConductorAuthError('Invalid Secret PIN or vehicle registration number.')
      }
    } finally {
      setIsCheckingPin(false)
    }
  }

  // FLEET OWNER: Fetch Buses
  const fetchOwnerBuses = async (email) => {
    try {
      const res = await fetch(`http://localhost:5000/api/owner/buses?email=${encodeURIComponent(email || ownerEmail)}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setOwnerBuses(data)
      }
    } catch {
      setOwnerBuses(Object.values(liveBuses))
    }
  }

  // FLEET OWNER: Send 6-Digit Email OTP
  const handleSendOwnerOtp = async (e) => {
    e?.preventDefault()
    setOwnerAuthError('')
    if (!ownerEmail || !ownerEmail.includes('@')) {
      setOwnerAuthError('Please enter a valid email address.')
      return
    }

    try {
      const res = await fetch('http://localhost:5000/api/owner/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail, agency_name: ownerAgencyName }),
      })
      const data = await res.json()
      if (data.success) {
        setOwnerOtpPreview(data.preview_otp || '123456')
        setOwnerOtpStep('otp')
      } else {
        setOwnerAuthError(data.error || 'Failed to send OTP.')
      }
    } catch {
      setOwnerOtpPreview('849201')
      setOwnerOtpStep('otp')
    }
  }

  // FLEET OWNER: Verify 6-Digit Email OTP
  const handleVerifyOwnerOtp = async (e) => {
    e?.preventDefault()
    setOwnerAuthError('')
    if (!ownerOtpInput) {
      setOwnerAuthError('Please enter the 6-digit OTP code.')
      return
    }

    try {
      const res = await fetch('http://localhost:5000/api/owner/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail, otp: ownerOtpInput }),
      })
      const data = await res.json()
      if (data.success) {
        setIsOwnerAuthenticated(true)
        setOwnerOtpStep('dashboard')
        fetchOwnerBuses(ownerEmail)
      } else {
        setOwnerAuthError(data.error || 'Invalid OTP code.')
      }
    } catch {
      if (ownerOtpInput === ownerOtpPreview || ownerOtpInput === '123456') {
        setIsOwnerAuthenticated(true)
        setOwnerOtpStep('dashboard')
        fetchOwnerBuses(ownerEmail)
      } else {
        setOwnerAuthError('Invalid OTP code. Please enter the 6-digit code.')
      }
    }
  }

  // FLEET OWNER: Add New Bus to Fleet
  const handleAddNewBusToFleet = async (e) => {
    e?.preventDefault()
    setOwnerNotice('')
    if (!newBusForm.bus_name || !newBusForm.vehicle_number) {
      setOwnerNotice('Please enter both Bus Name and Registration Number.')
      return
    }

    try {
      const res = await fetch('http://localhost:5000/api/owner/buses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBusForm,
          owner_email: ownerEmail,
        }),
      })
      const data = await res.json()
      if (data.success && data.bus) {
        setOwnerBuses((prev) => [...prev, data.bus])
        setShowAddBusModal(false)
        setOwnerNotice(`Bus ${data.bus.vehicle_number} registered! Secret Conductor PIN: ${data.bus.conductor_pin}`)
        setNewBusForm({
          bus_name: '',
          vehicle_number: '',
          route_number: '15',
          service_type: 'Express',
          origin: 'Mangaluru Statebank',
          destination: 'Surathkal',
          conductor_pin: Math.floor(1000 + Math.random() * 9000).toString(),
        })
      } else {
        setOwnerNotice(data.error || 'Failed to add bus to fleet.')
      }
    } catch {
      const mockBus = {
        bus_id: Date.now(),
        ...newBusForm,
        vehicle_number: newBusForm.vehicle_number.toUpperCase().replace(/\s+/g, '-'),
        owner_email: ownerEmail,
      }
      setOwnerBuses((prev) => [...prev, mockBus])
      setShowAddBusModal(false)
      setOwnerNotice(`Bus registered! Secret Conductor PIN: ${mockBus.conductor_pin}`)
    }
  }

  // FLEET OWNER: Update Secret Conductor PIN
  const handleUpdateBusPin = async (busId, currentPin) => {
    const newPin = window.prompt('Enter new 4-digit Secret Conductor PIN for this bus:', currentPin || '4509')
    if (!newPin || newPin.trim().length !== 4) {
      if (newPin !== null) alert('PIN must be exactly 4 digits.')
      return
    }

    try {
      await fetch(`http://localhost:5000/api/owner/buses/${busId}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_pin: newPin.trim() }),
      })
      setOwnerBuses((prev) =>
        prev.map((b) => (b.bus_id === busId ? { ...b, conductor_pin: newPin.trim() } : b))
      )
      setOwnerNotice(`Updated Secret Conductor PIN to ${newPin.trim()}`)
    } catch {
      setOwnerBuses((prev) =>
        prev.map((b) => (b.bus_id === busId ? { ...b, conductor_pin: newPin.trim() } : b))
      )
    }
  }

  // FLEET OWNER: Delete Bus
  const handleDeleteBus = async (busId, vehicleNum) => {
    if (!window.confirm(`Are you sure you want to remove bus ${vehicleNum} from your fleet?`)) return

    try {
      await fetch(`http://localhost:5000/api/owner/buses/${busId}`, { method: 'DELETE' })
      setOwnerBuses((prev) => prev.filter((b) => b.bus_id !== busId))
      setOwnerNotice(`Removed bus ${vehicleNum} from fleet.`)
    } catch {
      setOwnerBuses((prev) => prev.filter((b) => b.bus_id !== busId))
    }
  }

  // Conductor: Start duty & stream coordinates (Zomato-style Smart GPS Throttling)
  const handleStartShift = (event) => {
    event.preventDefault()
    setGpsError('')

    const fullRoute = `${busData.origin} ➔ ${busData.destination}`

    const broadcast = (lat, lng, speedVal, headingVal = null) => {
      // Step 1: Speed conversion (m/s to km/h)
      const speed = speedVal === null || speedVal === undefined ? 35 : Math.round(speedVal * 3.6)

      // Step 4: Speed Validation Check — Ignore unrealistic bus teleportation spikes
      if (speed > 100) {
        console.warn(`[GPS Jitter Filter] Ignored impossible speed spike: ${speed} km/h`)
        return
      }

      // Step 1: Smart GPS Throttling — Don't spam WebSocket if stationary or within 2.5s
      const now = Date.now()
      if (lastSentCoordsRef.current) {
        const [prevLat, prevLng] = lastSentCoordsRef.current
        const deltaKm = calculateDistanceKm(prevLat, prevLng, lat, lng)
        if (deltaKm < 0.01 && now - lastEmitTimeRef.current < 2500) {
          return
        }
      }
      lastEmitTimeRef.current = now
      lastSentCoordsRef.current = [lat, lng]

      const delayMinutes = speed < 25 ? 4 : 0
      const dist = calculateDistanceKm(passengerCoords[0], passengerCoords[1], lat, lng)
      const dynamicEta = Math.max(1, Math.round((dist / (speed || 35)) * 60))
      latestGpsRef.current = [lat, lng, speed, headingVal]

      socket.emit('update_location', {
        bus_id: busData.bus_id,
        driver_phone: busData.driver_phone,
        vehicle_number: busData.vehicle_number,
        bus_name: busData.bus_name,
        service_type: busData.service_type,
        route_number: busData.route_number,
        origin: busData.origin,
        destination: busData.destination,
        route_name: fullRoute,
        latitude: lat,
        longitude: lng,
        heading: headingVal,
        speed,
        delay_minutes: delayMinutes,
        eta_minutes: dynamicEta,
        estimated_arrival: `${dynamicEta} Mins away`,
        crowd_status: busData.crowd_status,
        is_last_bus: busData.is_last_bus,
        timestamp: Date.now(),
      })
    }

    if ('geolocation' in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed, heading, accuracy } = position.coords
          // GPS Jitter filter: discard readings with poor accuracy (> 50m)
          if (accuracy && accuracy > 50) return
          broadcast(latitude, longitude, speed, heading)
        },
        (error) => {
          console.error('GPS Error / Weak Signal:', error)
          // Step 4: Last Known Position Fallback & NH-66 Corridor Simulation for desktops
          if (!simTimer.current) {
            let step = 0
            const waypoints = [
              [12.8718, 74.8430], // Statebank (Terminal)
              [12.8850, 74.8450], // Hampankatta
              [12.8970, 74.8480], // Lalbagh
              [12.8997, 74.8530], // Nanthoor Jn
              [12.9271, 74.8415], // Kuloor Bridge
              [12.9350, 74.8210], // Baikampady
              [12.9472, 74.7963], // Surathkal (Terminus)
            ]
            broadcast(waypoints[0][0], waypoints[0][1], 35)
            simTimer.current = setInterval(() => {
              step = (step + 1) % waypoints.length
              broadcast(waypoints[step][0], waypoints[step][1], 38)
            }, 3000)
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000, // Accept cached positions up to 3 seconds old
          timeout: 5000,
        },
      )
    } else {
      broadcast(12.8997, 74.8530, 35)
    }

    setIsLoggedIn(true)
  }

  const handleEndShift = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    if (simTimer.current !== null) {
      clearInterval(simTimer.current)
      simTimer.current = null
    }
    lastSentCoordsRef.current = null
    lastEmitTimeRef.current = 0
    setGpsError('')
    setIsLoggedIn(false)
  }

  // Conductor: Real-time passenger crowd occupancy toggle
  const handleUpdateCrowdStatus = (newStatus, newCount = conductorPassengerCount) => {
    setBusData((prev) => ({ ...prev, crowd_status: newStatus }))
    setConductorPassengerCount(newCount)

    const [lat, lng, speed, headingVal] = latestGpsRef.current
    const fullRoute = `${busData.origin} ➔ ${busData.destination}`
    const dist = calculateDistanceKm(passengerCoords[0], passengerCoords[1], lat, lng)
    const dynamicEta = Math.max(1, Math.round((dist / (speed || 38)) * 60))

    socket.emit('update_location', {
      bus_id: busData.bus_id,
      driver_phone: busData.driver_phone,
      vehicle_number: busData.vehicle_number,
      bus_name: busData.bus_name,
      service_type: busData.service_type,
      route_number: busData.route_number,
      origin: busData.origin,
      destination: busData.destination,
      route_name: fullRoute,
      latitude: lat,
      longitude: lng,
      heading: headingVal,
      speed,
      delay_minutes: speed < 25 ? 4 : 0,
      eta_minutes: dynamicEta,
      estimated_arrival: `${dynamicEta} Mins away`,
      crowd_status: newStatus,
      passenger_count: newCount,
      is_last_bus: busData.is_last_bus,
    })
  }

  const handleAdjustPassengerCount = (delta) => {
    const updated = Math.max(0, Math.min(55, conductorPassengerCount + delta))
    let autoStatus = 'Seats Available'
    if (updated >= 42) {
      autoStatus = 'Overcrowded'
    } else if (updated >= 28) {
      autoStatus = 'Standing Allowed'
    }
    handleUpdateCrowdStatus(autoStatus, updated)
  }

  // Conductor: Broadcast road incident & weather alerts
  const handleBroadcastRoadAlert = (situationText) => {
    const alertData = {
      id: Date.now(),
      message: `📢 [${busData.bus_name} • KA-19]: ${situationText}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    socket.emit('send_alert', alertData)
    setAlerts((prev) => [alertData, ...prev])
    setBroadcastNotice(`Broadcasted to all commuters: "${situationText}"`)
    setTimeout(() => setBroadcastNotice(''), 4500)
  }

  // Filter buses for Step 2 based on chosen route/destination
  const filteredBuses = Object.values(liveBuses).filter((bus) => {
    if (selectedDestination !== 'All') {
      const df = selectedDestination.toLowerCase()
      const match =
        bus.destination?.toLowerCase().includes(df) ||
        bus.origin?.toLowerCase().includes(df) ||
        bus.route_name?.toLowerCase().includes(df)
      if (!match) return false
    }

    if (serviceTypeFilter === 'Express') {
      if (!bus.service_type?.toLowerCase().includes('express')) return false
    } else if (serviceTypeFilter === 'City') {
      if (bus.service_type?.toLowerCase().includes('express')) return false
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase()
      const searchMatch =
        bus.bus_name?.toLowerCase().includes(q) ||
        bus.route_name?.toLowerCase().includes(q) ||
        bus.route_number?.toLowerCase().includes(q) ||
        bus.destination?.toLowerCase().includes(q) ||
        bus.origin?.toLowerCase().includes(q)
      if (!searchMatch) return false
    }

    return true
  })

  // Sort filtered buses based on user-selected criteria (ETA, Fare, Seats)
  const sortedBuses = sortBuses(filteredBuses, sortBy, selectedDestination)

  // Handlers for Step Transitions
  const handleInitiateSearch = (e) => {
    e?.preventDefault()
    setPassengerStep(2)
  }

  const handleSelectBusToTrack = (bus) => {
    setPendingBusToTrack(bus)
    setShowLocationModal(true)
  }

  const handleConfirmLocationAndTrack = (useLiveGps = true) => {
    setShowLocationModal(false)
    if (pendingBusToTrack) {
      setSelectedBusId(pendingBusToTrack.bus_id)
    }

    if (useLiveGps && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPassengerCoords([pos.coords.latitude, pos.coords.longitude])
          setPassengerLocationName('Your Live GPS Location')
          setIsGpsActive(true)
          setPassengerStep(3)
        },
        () => {
          // Fallback to Statebank Terminal
          setPassengerCoords([12.8718, 74.8430])
          setPassengerLocationName('Mangaluru Statebank Central Terminal')
          setIsGpsActive(false)
          setPassengerStep(3)
        },
        { enableHighAccuracy: true, timeout: 5000 },
      )
    } else {
      setPassengerCoords([12.8718, 74.8430])
      setPassengerLocationName('Mangaluru Statebank Central Terminal')
      setIsGpsActive(false)
      setPassengerStep(3)
    }
  }

  // Live Tracked Bus in Step 3
  const trackedBus = liveBuses[selectedBusId]
  const distanceToPassenger = trackedBus
    ? calculateDistanceKm(
        passengerCoords[0],
        passengerCoords[1],
        trackedBus.latitude,
        trackedBus.longitude,
      )
    : null

  const mapCenter = trackedBus
    ? [trackedBus.latitude, trackedBus.longitude]
    : [12.9100, 74.8300]

  // Proximity sound chime trigger when tracked bus is within 1.2 km of passenger stop
  useEffect(() => {
    if (passengerStep === 3 && trackedBus && distanceToPassenger !== null) {
      const dist = Number(distanceToPassenger)
      if (dist <= 1.2 && hasChimededForBusRef.current !== trackedBus.bus_id) {
        hasChimededForBusRef.current = trackedBus.bus_id
        if (isAudioChimeEnabled) {
          playArrivalChime()
        }
      }
    }
  }, [passengerStep, trackedBus, distanceToPassenger, isAudioChimeEnabled])

  return (
    <main className="transit-app min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* 1. TOP OFFICIAL GOVERNMENT MICRO-HEADER */}
      <div className="gov-topbar bg-slate-950 text-slate-300 text-xs px-6 py-2 border-b-2 border-blue-600">
        <div className="gov-topbar-content max-w-7xl mx-auto flex items-center justify-between">
          <span className="gov-title font-semibold tracking-wide">
            {t.govTitle}
          </span>
          <span className="gov-badge bg-white/10 px-2.5 py-0.5 rounded text-blue-300 text-xs font-semibold">
            {t.govBadge}
          </span>
        </div>
      </div>

      {/* 2. OFFICIAL MAIN APP HEADER */}
      <header className="app-header bg-white border-b border-slate-200 px-6 py-3 shadow-sm flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
        <div className="brand flex items-center gap-3">
          <span className="brand-icon w-11 h-11 rounded-xl bg-gradient-to-br from-blue-900 to-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Bus size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="app-title text-xl font-extrabold text-slate-900 tracking-tight m-0">
              {t.appTitle}
            </h1>
            <p className="brand-subtitle text-xs font-semibold text-slate-500 m-0">
              {t.brandSubtitle}
            </p>
          </div>
        </div>

        {/* Database & GPS Live Status */}
        <div className="system-status-badge hidden lg:flex items-center gap-2 px-3.5 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-bold text-green-800">
          <span className="status-dot-green w-2 h-2 rounded-full bg-green-600 shadow-sm animate-pulse" />
          <span>{dbStatus ? t.dbConnected : t.gpsLive}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Bilingual Language Switcher Button */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="lang-toggle-btn px-3 py-1.5 rounded-xl border border-slate-300 hover:border-blue-600 bg-white hover:bg-blue-50 text-slate-800 font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title={lang === 'en' ? 'ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಿ' : 'Switch to English'}
          >
            <span className="text-sm">🌐</span>
            <span>{t.langToggle}</span>
          </button>

          {/* User-Friendly Role Switcher */}
          <nav className="role-switch flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1" aria-label="Switch User Mode">
            <button
              type="button"
              onClick={() => {
                setRole('passenger')
              }}
              className={`role-button px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${role === 'passenger' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Bus size={15} />
              <span>{t.passengerRadar}</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('conductor')}
              className={`role-button px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${role === 'conductor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Radio size={15} />
              <span>{t.conductorTerminal}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('owner')
                if (isOwnerAuthenticated) {
                  fetchOwnerBuses(ownerEmail)
                }
              }}
              className={`role-button px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${role === 'owner' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Building size={15} />
              <span>{t.fleetOwner}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* 3. ROTATING PASSENGER ADVISORY TICKER */}
      {alerts.length > 0 && role === 'passenger' && (
        <div className="alert-banner bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs font-semibold text-amber-900 flex items-center gap-2" role="status">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span className="ticker-alert truncate">{alerts[currentAlertIndex]?.message}</span>
        </div>
      )}

      {/* 4. MAIN CONTENT AREA */}
      <section className="app-content flex-1 flex flex-col">
        {role === 'passenger' ? (
          <div className="passenger-flow flex-1 flex flex-col">
            {/* STEP PROGRESSION BREADCRUMB INDICATOR */}
            <nav className="step-progress-nav bg-white border-b border-slate-200 py-2.5 px-4 flex items-center justify-center gap-2 text-xs font-bold">
              <span className={`step-item px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${passengerStep === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <span>1</span> Destination Selection
              </span>
              <span className="step-divider text-slate-400">➔</span>
              <span className={`step-item px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${passengerStep === 2 ? 'bg-blue-600 text-white' : passengerStep > 2 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-400'}`}>
                <span>2</span> Incoming Buses
              </span>
              <span className="step-divider text-slate-400">➔</span>
              <span className={`step-item px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${passengerStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                <span>3</span> Live Tracking Map
              </span>
            </nav>

            {/* ============================================================== */}
            {/* STEP 1: DESTINATION & ROUTE SELECTION (DEFAULT LANDING)        */}
            {/* NO map or bus list visible at this stage                        */}
            {/* ============================================================== */}
            {passengerStep === 1 && (
              <div className="step1-container flex-1 flex items-center justify-center p-6 bg-slate-50">
                <div className="step1-card w-full max-w-xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col gap-6">
                  {/* Hero Header */}
                  <div className="step1-hero text-center">
                    <span className="step1-badge inline-block bg-blue-50 text-blue-700 text-xs font-extrabold px-3 py-1 rounded-full border border-blue-200 mb-2">
                      Coastal Smart Transit • ಕರಾವಳಿ ಸಾರಿಗೆ
                    </span>
                    <h2 className="step1-title text-2xl font-extrabold text-slate-900 tracking-tight m-0">
                      {t.whereHeading}
                    </h2>
                    <p className="step1-subtitle text-slate-500 text-sm mt-1">
                      {t.destinationSubtitle}
                    </p>
                  </div>

                  {/* Boarding Stop Indicator */}
                  <div className="boarding-card bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        {t.boardingFrom}
                      </span>
                      <strong className="text-sm font-extrabold text-slate-900">
                        {passengerLocationName}
                      </strong>
                    </div>
                  </div>

                  {/* 1-Tap Quick Destination Pills */}
                  <div className="quick-filter-group flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {t.popularDestinations}:
                    </label>
                    <div className="destination-pills-grid grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: 'Surathkal', name: lang === 'kn' ? 'ಸುರತ್ಕಲ್ / ಎನ್.ಐ.ಟಿ.ಕೆ' : 'Surathkal / NITK', desc: lang === 'kn' ? '10.5 ಕಿ.ಮೀ ಕಾರಿಡಾರ್' : '10.5 km Corridor' },
                        { id: 'Udupi', name: lang === 'kn' ? 'ಉಡುಪಿ' : 'Udupi', desc: lang === 'kn' ? 'ಕರಾವಳಿ ಎಕ್ಸ್‌ಪ್ರೆಸ್' : 'Coastal Express' },
                        { id: 'Kuloor', name: lang === 'kn' ? 'ಕುಳೂರು ಸೇತುವೆ' : 'Kuloor Bridge', desc: lang === 'kn' ? 'ಸಿಟಿ ಸಾಮಾನ್ಯ' : 'City Ordinary' },
                        { id: 'Statebank', name: lang === 'kn' ? 'ಸ್ಟೇಟ್‌ಬ್ಯಾಂಕ್' : 'Statebank', desc: lang === 'kn' ? 'ಕೇಂದ್ರ ನಿಲ್ದಾಣ' : 'Central Terminal' },
                        { id: 'All', name: lang === 'kn' ? 'ಎಲ್ಲಾ ಮಾರ್ಗಗಳು' : 'All Routes', desc: lang === 'kn' ? 'ಎಲ್ಲಾ ಬಸ್‌ಗಳು' : 'Show All Buses' },
                      ].map((dest) => (
                        <button
                          key={dest.id}
                          type="button"
                          onClick={() => setSelectedDestination(dest.id)}
                          className={`dest-select-btn p-3 rounded-xl border-2 text-left transition-all ${selectedDestination === dest.id ? 'border-blue-600 bg-blue-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                        >
                          <span className="dest-btn-name block text-sm font-extrabold text-slate-900">
                            {dest.name}
                          </span>
                          <span className="dest-btn-desc block text-xs text-slate-500">
                            {dest.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Optional Search Input */}
                  <div className="search-box flex items-center bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 gap-2.5 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <Search size={18} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder={t.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent border-0 outline-none text-sm text-slate-900 placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-slate-400 hover:text-slate-600"
                        title="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Service Classification Selector */}
                  <div className="service-filter-row flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase">Service Category:</span>
                    <div className="service-toggle flex bg-slate-100 p-1 rounded-lg gap-1 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setServiceTypeFilter('All')}
                        className={`px-3 py-1.5 rounded-md transition-all ${serviceTypeFilter === 'All' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceTypeFilter('Express')}
                        className={`px-3 py-1.5 rounded-md transition-all ${serviceTypeFilter === 'Express' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
                      >
                        ⚡ Express
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceTypeFilter('City')}
                        className={`px-3 py-1.5 rounded-md transition-all ${serviceTypeFilter === 'City' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}
                      >
                        🚌 Ordinary
                      </button>
                    </div>
                  </div>

                  {/* Primary CTA Button: Proceed to Step 2 */}
                  <button
                    type="button"
                    onClick={handleInitiateSearch}
                    className="search-incoming-btn w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{t.searchIncomingBuses}</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 2: FILTERED BUS LIST SCREEN                               */}
            {/* Displays clean list of ONLY operating buses for this corridor  */}
            {/* ============================================================== */}
            {passengerStep === 2 && (
              <div className="step2-container max-w-4xl w-full mx-auto p-6 flex flex-col gap-4">
                {/* Header with Back button, count and multi-criteria sorting */}
                <div className="step2-nav-header bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPassengerStep(1)}
                        className="step2-back-btn flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        title="Back to Step 1: Change Destination"
                      >
                        <ArrowLeft size={16} />
                        <span>{t.changeDestination || 'Change Destination'}</span>
                      </button>
                      <div>
                        <h2 className="step2-destination-title text-base font-extrabold text-slate-900 m-0">
                          {t.step2Title || 'Incoming Buses to:'} <span className="text-blue-600">{selectedDestination === 'All' ? 'All Coastal Corridors' : selectedDestination}</span>
                        </h2>
                        <span className="text-xs text-slate-500">Boarding at {passengerLocationName}</span>
                      </div>
                    </div>

                    <span className="step2-bus-count-badge bg-blue-50 text-blue-700 border border-blue-200 text-xs font-extrabold px-3 py-1 rounded-full">
                      {filteredBuses.length} Active {filteredBuses.length === 1 ? 'Bus' : 'Buses'} Operating
                    </span>
                  </div>

                  {/* Multi-Criteria Bus Sorting Controls */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-bold">{t.sortByLabel || 'Sort by:'}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSortBy('eta')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          sortBy === 'eta' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {t.sortEta || '⚡ Earliest ETA'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortBy('fare')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          sortBy === 'fare' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {t.sortFare || '💰 Lowest Fare'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortBy('seats')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          sortBy === 'seats' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {t.sortSeats || '💺 Most Seats'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Empty State */}
                {filteredBuses.length === 0 ? (
                  <div className="empty-buses-box bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center flex flex-col items-center gap-3">
                    <Bus size={36} className="text-slate-300" />
                    <p className="text-slate-600 font-semibold text-sm m-0">
                      No active buses currently operating towards "{selectedDestination}".
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDestination('All')
                        setServiceTypeFilter('All')
                        setSearchQuery('')
                      }}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all cursor-pointer"
                    >
                      Show All Routes
                    </button>
                  </div>
                ) : (
                  /* Filtered Bus Cards Grid */
                  <div className="step2-bus-grid flex flex-col gap-3">
                    {sortedBuses.map((bus) => {
                      const isExpress = (bus.service_type || '').toLowerCase().includes('express')
                      const isDelayed = (bus.delay_minutes || 0) > 0
                      const estFare = calculateEstimatedFare(bus, selectedDestination)

                      return (
                        <article
                          key={bus.bus_id}
                          className="bus-card-simple bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col gap-3"
                        >
                          {/* Top: Route Tag, Name, Service Badge & Fare Pill */}
                          <div className="card-top flex items-start justify-between gap-3">
                            <div className="card-title-block flex items-center flex-wrap gap-2.5">
                              <span className="route-tag bg-slate-900 text-white text-xs font-extrabold px-2.5 py-1 rounded-md">
                                Route #{bus.route_number || '15'}
                              </span>
                              <h3 className="bus-name text-base font-extrabold text-slate-900 m-0">
                                {bus.bus_name}
                              </h3>
                              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {bus.vehicle_number}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="fare-badge text-xs font-black px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full flex items-center gap-1">
                                <span>₹{estFare}</span>
                                <span className="text-[10px] text-emerald-600 font-semibold">{t.stageFareEst || 'Fare'}</span>
                              </span>
                              <span className={`service-badge text-xs font-extrabold px-3 py-1 rounded-full ${isExpress ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                {isExpress ? '⚡ Express Service' : '🚌 City / Ordinary'}
                              </span>
                            </div>
                          </div>

                          {/* Route Corridor */}
                          <p className="card-route text-xs font-semibold text-slate-600 m-0">
                            Corridor: <span className="text-slate-900 font-bold">{bus.route_name}</span>
                          </p>

                          {/* Highlights: Arrival ETA, Schedule, Stage Fare, Delay Status */}
                          <div className="card-highlights grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                            <div className="highlight-item flex flex-col">
                              <span className="text-slate-500 font-bold uppercase text-[10px]">Next Stop Arrival</span>
                              <strong className="text-blue-700 text-sm font-extrabold">{bus.eta_minutes ?? 3} MINS</strong>
                            </div>
                            <div className="highlight-item flex flex-col">
                              <span className="text-slate-500 font-bold uppercase text-[10px]">Expected Time</span>
                              <strong className="text-slate-900 text-sm font-bold">{bus.estimated_arrival || '1:15 PM'}</strong>
                            </div>
                            <div className="highlight-item flex flex-col">
                              <span className="text-slate-500 font-bold uppercase text-[10px]">Corridor Fare</span>
                              <strong className="text-emerald-700 text-sm font-black">₹{estFare} ({isExpress ? 'Express' : 'Ordinary'})</strong>
                            </div>
                            <div className="highlight-item flex flex-col">
                              <span className="text-slate-500 font-bold uppercase text-[10px]">Delay Status</span>
                              <strong className={`text-sm font-bold ${isDelayed ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {isDelayed ? `+${bus.delay_minutes}m Late` : 'On Time'}
                              </strong>
                            </div>
                          </div>

                          {/* Bottom Row: Crowd Load, Last Bus & Action CTA */}
                          <div className="track-action-bar flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="crowd-pill text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                                {bus.crowd_status || 'Seats Available'}
                              </span>
                              {bus.is_last_bus && (
                                <span className="lastbus-pill text-xs font-extrabold px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded-md flex items-center gap-1">
                                  🌙 LAST BUS OF THE NIGHT
                                </span>
                              )}
                            </div>

                            {/* SELECT & TRACK THIS BUS BUTTON */}
                            <button
                              type="button"
                              onClick={() => handleSelectBusToTrack(bus)}
                              className="track-action-btn bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-sm hover:shadow flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <span>Select &amp; Track This Bus</span>
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 3: LIVE TRACKING MAP VIEW (ACTIVATED ON BUS SELECTION)    */}
            {/* Centered on selected bus with prominent "Switch Bus / Exit Map"*/}
            {/* ============================================================== */}
            {passengerStep === 3 && trackedBus && (
              <div className={isFullscreenMap ? "step3-container fixed inset-0 z-50 bg-white flex flex-col w-screen h-screen overflow-hidden" : "step3-container flex-1 flex flex-col relative h-[calc(100vh-140px)] min-h-[500px]"}>
                {/* STEP 3 TOP NAVIGATION BAR WITH "SWITCH BUS / EXIT MAP" BUTTON */}
                <div className="step3-topbar bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4 z-10 shadow-sm">
                  <div className="flex items-center gap-3">
                    {/* CRITICAL FEATURE: "SWITCH BUS / EXIT MAP" BUTTON */}
                    <button
                      type="button"
                      onClick={() => {
                        hasChimededForBusRef.current = null
                        setIsFullscreenMap(false)
                        setPassengerStep(2)
                      }}
                      className="switch-bus-btn bg-slate-900 hover:bg-blue-600 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer"
                      title="Return to Step 2 Bus List"
                    >
                      <ArrowLeft size={16} />
                      <span>Switch Bus / Exit Map</span>
                    </button>

                    <div className="hidden sm:block">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-extrabold text-slate-900 block">
                          Tracking: {trackedBus.bus_name} (Route #{trackedBus.route_number})
                        </strong>
                        {isGpsActive && (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            trackedBus.timestamp && (currentTime - trackedBus.timestamp > 15000)
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {trackedBus.timestamp && (currentTime - trackedBus.timestamp > 15000)
                              ? '📍 Last Known Position (Holding)'
                              : '🛰️ Live GPS Active'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {distanceToPassenger} km away from your stop • {trackedBus.route_name}
                      </span>
                    </div>
                  </div>

                  {/* Live Quick Metrics in Header */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAudioChimeEnabled((prev) => !prev)}
                      title={isAudioChimeEnabled ? 'Arrival proximity chime is active' : 'Arrival proximity chime is muted'}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isAudioChimeEnabled
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {isAudioChimeEnabled ? <Volume2 size={14} className="text-emerald-700" /> : <VolumeX size={14} className="text-slate-400" />}
                      <span className="hidden sm:inline">{isAudioChimeEnabled ? 'Chime Active' : 'Muted'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFullscreenMap((prev) => !prev)}
                      title={isFullscreenMap ? 'Exit Fullscreen' : 'Expand Fullscreen Radar'}
                      className="px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300 cursor-pointer"
                    >
                      {isFullscreenMap ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      <span className="hidden sm:inline">{isFullscreenMap ? 'Normal' : 'Fullscreen'}</span>
                    </button>
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      ETA: {trackedBus.eta_minutes ?? 3} Mins
                    </span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                      {trackedBus.speed ?? 38} km/h
                    </span>
                  </div>
                </div>

                {/* FLOATING HUD ON MAP */}
                <div className="floating-hud absolute top-16 left-4 right-4 z-20 bg-white/95 backdrop-blur-md border border-blue-200 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="hud-left flex items-center gap-3">
                      <span className="pulsing-green-dot w-3 h-3 rounded-full bg-emerald-500 shadow animate-ping" />
                      <div>
                        <div className="hud-bus-header flex items-center gap-2">
                          <strong className="hud-bus-name text-base font-extrabold text-slate-900">
                            {trackedBus.bus_name}
                          </strong>
                          <span className="route-tag bg-slate-900 text-white text-[10px] font-extrabold px-2 py-0.5 rounded">
                            Route #{trackedBus.route_number}
                          </span>
                          <span className="service-badge text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {trackedBus.service_type}
                          </span>
                        </div>
                        <span className="hud-bus-route text-xs text-slate-600 block mt-0.5">
                          {trackedBus.route_name} • <strong>{distanceToPassenger} km to your stop</strong>
                        </span>
                      </div>
                    </div>

                    <div className="hud-stats flex items-center gap-4 text-xs">
                      <div className="hud-stat flex flex-col">
                        <span className="text-slate-400 uppercase text-[9px] font-extrabold">Distance</span>
                        <strong className="text-blue-700 text-sm font-extrabold">{distanceToPassenger} km</strong>
                      </div>
                      <div className="hud-stat flex flex-col">
                        <span className="text-slate-400 uppercase text-[9px] font-extrabold">Next Arrival</span>
                        <strong className="text-slate-900 text-sm font-extrabold">{trackedBus.eta_minutes ?? 3} Mins ({trackedBus.estimated_arrival || '1:15 PM'})</strong>
                      </div>
                      <div className="hud-stat flex flex-col">
                        <span className="text-slate-400 uppercase text-[9px] font-extrabold">Speed</span>
                        <strong className="text-slate-900 text-sm font-bold">{trackedBus.speed ?? 38} km/h</strong>
                      </div>
                      <div className="hud-stat flex flex-col">
                        <span className="text-slate-400 uppercase text-[9px] font-extrabold">Status</span>
                        <strong className={`text-sm font-bold ${trackedBus.delay_minutes > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {trackedBus.delay_minutes > 0 ? `+${trackedBus.delay_minutes}m Delay` : 'On Time'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* PROXIMITY ARRIVAL ALERT BANNER (WITHIN 1.2 KM) */}
                  {distanceToPassenger !== null && Number(distanceToPassenger) <= 1.2 && (
                    <div className="w-full pt-2 border-t border-emerald-100 flex items-center justify-between gap-3 text-xs bg-emerald-50 text-emerald-900 rounded-xl px-3 py-2 animate-pulse">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                        <strong className="font-extrabold">
                          Bus Approaching Your Stop ({distanceToPassenger} km) — Prepare to board!
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAudioChimeEnabled((prev) => !prev)}
                        title={isAudioChimeEnabled ? 'Mute arrival chime' : 'Unmute arrival chime'}
                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all"
                      >
                        {isAudioChimeEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                        <span>{isAudioChimeEnabled ? 'Chimed' : 'Muted'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* LEAFLET MAP VIEW */}
                <div className="map-panel flex-1 relative w-full h-full">
                  <Suspense fallback={<div className="map-loading grid place-items-center h-full bg-slate-100 text-slate-500 font-bold">Loading coastal transit map…</div>}>
                    <TransitMap
                      buses={filteredBuses}
                      selectedBusId={selectedBusId}
                      onSelectBus={(busId) => setSelectedBusId(busId)}
                      mapCenter={mapCenter}
                      passengerCoords={passengerCoords}
                      passengerStopName={passengerLocationName}
                      isFullscreen={isFullscreenMap}
                      onToggleFullscreen={() => setIsFullscreenMap((prev) => !prev)}
                    />
                  </Suspense>

                  {/* DOCKED STOP-BY-STOP CORRIDOR PROGRESSION STEPPER */}
                  <div className="corridor-stepper-dock absolute bottom-3 left-4 right-4 z-20 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                        <Bus size={14} className="text-blue-600" />
                        NH-66 Highway Route Progress: {trackedBus.bus_name}
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                        Corridor Stepper
                      </span>
                    </div>

                    <div className="corridor-stepper-track flex items-center justify-between gap-1 overflow-x-auto py-1">
                      {corridorStopsList.map((stop, index) => {
                        const isSouthbound = trackedBus.route_name?.toLowerCase().includes('statebank') && !trackedBus.route_name?.toLowerCase().startsWith('mangaluru')
                        const isPassed = isSouthbound
                          ? trackedBus.latitude < stop.lat - 0.003
                          : trackedBus.latitude > stop.lat + 0.003
                        const isCurrent = Math.abs(trackedBus.latitude - stop.lat) <= 0.005

                        return (
                          <div key={stop.name} className="stepper-node flex flex-col items-center flex-1 min-w-[70px] text-center">
                            <div className={`stepper-node-dot w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold border-2 transition-all ${
                              isCurrent
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-4 ring-blue-100 animate-pulse'
                                : isPassed
                                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                                  : 'bg-slate-100 text-slate-400 border-slate-200'
                            }`}>
                              {isCurrent ? '🚍' : isPassed ? '✓' : index + 1}
                            </div>
                            <span className={`text-[10px] mt-1 font-bold truncate max-w-[80px] ${
                              isCurrent ? 'text-blue-700 font-extrabold' : isPassed ? 'text-emerald-700' : 'text-slate-500'
                            }`}>
                              {stop.name}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : role === 'conductor' ? (
          /* ============================================================== */
          /* CONDUCTOR / STAFF DUTY PORTAL (REAL-WORLD BUS NO + SECRET PIN) */
          /* ============================================================== */
          <div className="conductor-page flex-1 flex items-center justify-center p-6 bg-slate-50">
            <div className="conductor-box w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              {!isConductorAuthenticated ? (
                /* 1. REAL-WORLD CONDUCTOR CHECK-IN SCREEN */
                <form onSubmit={handleConductorCheckIn} className="conductor-login-form flex flex-col gap-4">
                  <div className="form-head text-center">
                    <span className="driver-avatar w-12 h-12 rounded-full bg-blue-100 text-blue-700 mx-auto flex items-center justify-center mb-2">
                      <Radio size={24} />
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight m-0">
                      Conductor Duty Check-In
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Enter your assigned bus registration and 4-digit secret PIN to unlock duty.
                    </p>
                  </div>

                  {/* 1-Click Fleet Bus Selector */}
                  <div className="quick-presets flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="presets-title text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Quick Select Registered Bus:
                    </span>
                    <div className="preset-buttons grid grid-cols-2 gap-2 text-xs font-bold">
                      {Object.values(liveBuses).slice(0, 4).map((b) => (
                        <button
                          key={b.bus_id}
                          type="button"
                          onClick={() => {
                            setConductorVehicleInput(b.vehicle_number)
                            setConductorPinInput(b.conductor_pin || '4509')
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            conductorVehicleInput === b.vehicle_number
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="font-extrabold truncate">{b.vehicle_number}</div>
                          <div className={`text-[10px] truncate ${conductorVehicleInput === b.vehicle_number ? 'text-blue-100' : 'text-slate-500'}`}>
                            {b.bus_name} (#{b.route_number})
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vehicle Number Input */}
                  <div className="input-field flex flex-col gap-1 text-xs">
                    <label htmlFor="conductor-veh-input" className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Bus size={14} className="text-blue-600" />
                      <span>Bus Vehicle Registration Number</span>
                    </label>
                    <input
                      id="conductor-veh-input"
                      type="text"
                      placeholder="e.g. KA-19-AB-4509"
                      value={conductorVehicleInput}
                      onChange={(e) => setConductorVehicleInput(e.target.value)}
                      required
                      className="p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-extrabold uppercase text-sm tracking-wider"
                    />
                  </div>

                  {/* 4-Digit Secret PIN Input */}
                  <div className="input-field flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between">
                      <label htmlFor="conductor-pin-input" className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Lock size={14} className="text-blue-600" />
                        <span>4-Digit Secret Conductor PIN</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowConductorPin(!showConductorPin)}
                        className="text-slate-500 hover:text-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {showConductorPin ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{showConductorPin ? 'Hide PIN' : 'Show PIN'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="conductor-pin-input"
                        type={showConductorPin ? 'text' : 'password'}
                        maxLength={4}
                        placeholder="••••"
                        value={conductorPinInput}
                        onChange={(e) => setConductorPinInput(e.target.value.replace(/\D/g, ''))}
                        required
                        className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-mono text-center text-lg font-extrabold tracking-widest"
                      />
                    </div>
                  </div>

                  {/* Staff Phone (Optional) */}
                  <div className="input-field flex flex-col gap-1 text-xs">
                    <label htmlFor="conductor-phone-input" className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Smartphone size={14} className="text-slate-500" />
                      <span>Conductor Mobile Number (For Shift Logging)</span>
                    </label>
                    <input
                      id="conductor-phone-input"
                      type="tel"
                      value={conductorPhoneInput}
                      onChange={(e) => setConductorPhoneInput(e.target.value)}
                      className="p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-semibold text-xs"
                    />
                  </div>

                  {/* Test Demo Helper Badge */}
                  <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-3 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <KeyRound size={16} className="text-blue-600 shrink-0" />
                      <span>Demo Credentials: <strong>KA-19-AB-4509</strong> • PIN: <strong>4509</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setConductorVehicleInput('KA-19-AB-4509')
                        setConductorPinInput('4509')
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                    >
                      Fill
                    </button>
                  </div>

                  {conductorAuthError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                      <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                      <span>{conductorAuthError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isCheckingPin}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck size={18} />
                    <span>{isCheckingPin ? 'Verifying PIN with Database…' : 'Unlock Bus & Verify PIN ➔'}</span>
                  </button>
                </form>
              ) : (
                /* 2. AUTHENTICATED CONDUCTOR DUTY TERMINAL */
                <div className="authenticated-conductor flex flex-col gap-4">
                  {/* Verified Bus Identity Banner */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                        🚍
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 font-extrabold text-sm">{busData.bus_name}</strong>
                          <span className="bg-emerald-200 text-emerald-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            PIN Verified ✅
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          {busData.vehicle_number} • Route #{busData.route_number} ({busData.origin} ➔ {busData.destination})
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (isLoggedIn) handleEndShift()
                        setIsConductorAuthenticated(false)
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                    >
                      Change Bus
                    </button>
                  </div>

                  {!isLoggedIn ? (
                    /* ONE-TAP START SHIFT BUTTON */
                    <div className="unstarted-duty flex flex-col gap-4 text-center py-2">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2">
                        <span className="text-[11px] font-extrabold uppercase text-slate-500 block">Pre-Shift Verification</span>
                        <div className="grid grid-cols-2 gap-2 text-slate-800 font-bold">
                          <div>Staff Phone: <span className="text-slate-600">{busData.driver_phone}</span></div>
                          <div>Service Type: <span className="text-blue-700">{busData.service_type}</span></div>
                          <div>Database Sync: <span className="text-emerald-700">Connected</span></div>
                          <div>GPS Satellite: <span className="text-emerald-700">Standby Ready</span></div>
                        </div>
                      </div>

                      <div className="form-row-2 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center text-xs text-left">
                        <div className="input-field flex flex-col gap-1">
                          <label htmlFor="crowd-initial" className="font-bold text-slate-700">Initial Seating Load</label>
                          <select
                            id="crowd-initial"
                            value={busData.crowd_status}
                            onChange={(e) => setBusData({ ...busData, crowd_status: e.target.value })}
                            className="p-2.5 rounded-lg border border-slate-300 focus:border-blue-600 outline-none bg-white font-bold"
                          >
                            <option value="Seats Available">🟢 Seats Available</option>
                            <option value="Standing Allowed">🟡 Standing Allowed</option>
                            <option value="Overcrowded">🔴 Full Capacity</option>
                          </select>
                        </div>

                        <label htmlFor="last-bus-initial" className="checkbox-item flex items-center gap-2 font-bold text-rose-800 bg-rose-50 p-2.5 rounded-lg border border-rose-200 cursor-pointer mt-4 sm:mt-0">
                          <input
                            type="checkbox"
                            id="last-bus-initial"
                            checked={busData.is_last_bus}
                            onChange={(e) => setBusData({ ...busData, is_last_bus: e.target.checked })}
                            className="w-4 h-4 text-rose-600"
                          />
                          <span>Night Last Bus Service</span>
                        </label>
                      </div>

                      {gpsError && <p className="gps-warning-text text-rose-600 text-xs font-bold">{gpsError}</p>}

                      <button
                        type="button"
                        onClick={handleStartShift}
                        className="start-shift-btn w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Navigation size={22} />
                        <span>One-Tap Start Shift &amp; Stream GPS ➔</span>
                      </button>
                    </div>
                  ) : (
                    /* ACTIVE DUTY STATUS VIEW */
                    <div className="active-shift-card flex flex-col gap-4 text-center">
                      <div className="active-header">
                        <span className="live-pulse-icon w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-2 animate-bounce">
                          <Navigation size={28} />
                        </span>
                        <h2 className="text-xl font-extrabold text-slate-900 m-0">
                          Duty Active &amp; Streaming GPS
                        </h2>
                        <p className="subtext text-xs text-slate-500 font-semibold mt-1">
                          GPS coordinates are broadcasting live to passengers along NH-66 corridor.
                        </p>
                      </div>

                      {/* REAL-TIME PASSENGER CROWD & OCCUPANCY CONTROLS */}
                      <div className="conductor-crowd-card bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase font-extrabold text-slate-500">
                            Live Passenger Occupancy
                          </span>
                          <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                            busData.crowd_status === 'Seats Available'
                              ? 'bg-emerald-100 text-emerald-800'
                              : busData.crowd_status === 'Standing Allowed'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}>
                            {busData.crowd_status}
                          </span>
                        </div>

                        {/* Quick Status Buttons */}
                        <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => handleUpdateCrowdStatus('Seats Available')}
                            className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                              busData.crowd_status === 'Seats Available'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            🟢 Seats Avail
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateCrowdStatus('Standing Allowed')}
                            className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                              busData.crowd_status === 'Standing Allowed'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            🟡 Standing
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateCrowdStatus('Overcrowded')}
                            className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                              busData.crowd_status === 'Overcrowded'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            🔴 Full
                          </button>
                        </div>

                        {/* Passenger Boarding Counter */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">
                              Onboard: <strong>{conductorPassengerCount} / 42 Seats</strong>
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {Math.round((conductorPassengerCount / 42) * 100)}% Capacity
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAdjustPassengerCount(-1)}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-extrabold text-slate-700 flex items-center justify-center cursor-pointer shadow-sm"
                              title="1 Passenger Alighted"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustPassengerCount(1)}
                              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 font-extrabold text-white flex items-center justify-center cursor-pointer shadow-sm"
                              title="1 Passenger Boarded"
                            >
                              +1
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* REAL-TIME CORRIDOR INCIDENT & ROAD ALERT BROADCASTER */}
                      <div className="conductor-alert-card bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex flex-col gap-2.5 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase font-extrabold text-amber-900 flex items-center gap-1.5">
                            <AlertTriangle size={14} className="text-amber-600" />
                            Corridor Incident &amp; Delay Broadcaster
                          </span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                            Live Push
                          </span>
                        </div>

                        <p className="text-[11px] text-amber-800 m-0">
                          Tap a situation preset below to broadcast an instant road alert to all commuters along NH-66:
                        </p>

                        <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => handleBroadcastRoadAlert('Heavy traffic delay at Nanthoor Junction (+6m delay)')}
                            className="p-2 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/60 text-slate-800 text-left transition-all cursor-pointer shadow-sm"
                          >
                            ⚠️ Nanthoor Jam
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBroadcastRoadAlert('Heavy monsoon rain slowdown near Kuloor Bridge')}
                            className="p-2 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/60 text-slate-800 text-left transition-all cursor-pointer shadow-sm"
                          >
                            🌧️ Kuloor Rain
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBroadcastRoadAlert('Road resurfacing work near Baikampady. Normal speed resumed shortly')}
                            className="p-2 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/60 text-slate-800 text-left transition-all cursor-pointer shadow-sm"
                          >
                            🚧 Baikampady Work
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBroadcastRoadAlert('Final night service of the day. Connects all stops to Surathkal')}
                            className="p-2 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/60 text-slate-800 text-left transition-all cursor-pointer shadow-sm"
                          >
                            🌙 Night Last Bus
                          </button>
                        </div>

                        {broadcastNotice && (
                          <div className="p-2 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                            <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
                            <span>{broadcastNotice}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleEndShift}
                        className="end-shift-btn w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm py-3 px-6 rounded-xl shadow transition-all cursor-pointer"
                      >
                        End Duty &amp; Stop Streaming
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* FLEET OWNER COMMAND CENTER (EMAIL OTP LOGIN & FLEET MGMT)      */
          /* ============================================================== */
          <div className="owner-page flex-1 p-6 bg-slate-50 overflow-y-auto">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
              {!isOwnerAuthenticated ? (
                /* OWNER LOGIN: EMAIL + GMAIL OTP AUTHENTICATION */
                <div className="flex items-center justify-center min-h-[500px]">
                  <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
                    <div className="text-center space-y-2">
                      <span className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 mx-auto flex items-center justify-center shadow-sm">
                        <Building size={24} />
                      </span>
                      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        Fleet Owner Command
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">
                        Secure Fleet Management &amp; Conductor PIN Administration with Email OTP
                      </p>
                    </div>

                    {ownerOtpStep === 'email' ? (
                      <form onSubmit={handleSendOwnerOtp} className="space-y-4 text-xs">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Owner Registered Email</label>
                          <div className="relative">
                            <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                            <input
                              type="email"
                              placeholder="e.g. vishal@gmail.com"
                              value={ownerEmail}
                              onChange={(e) => setOwnerEmail(e.target.value)}
                              required
                              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-semibold text-sm"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Bus Travel Agency / Operator Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Vishal Coastal Travels"
                            value={ownerAgencyName}
                            onChange={(e) => setOwnerAgencyName(e.target.value)}
                            required
                            className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-semibold text-sm"
                          />
                        </div>

                        {ownerAuthError && (
                          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-center gap-2">
                            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                            <span>{ownerAuthError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Mail size={16} />
                          <span>Send 6-Digit Email OTP ➔</span>
                        </button>

                        <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl p-3 text-[11px] text-center">
                          💡 Quick Demo: Use <strong>vishal@gmail.com</strong> to access pre-registered fleet.
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOwnerOtp} className="space-y-4 text-xs">
                        {/* OTP Dispatch Notification */}
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3 text-xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            <span>Code sent to <strong>{ownerEmail}</strong></span>
                          </div>
                          {ownerOtpPreview && (
                            <button
                              type="button"
                              onClick={() => setOwnerOtpInput(ownerOtpPreview)}
                              className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-[10px] cursor-pointer"
                            >
                              Fill: {ownerOtpPreview}
                            </button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Enter 6-Digit OTP Code</label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="••••••"
                            value={ownerOtpInput}
                            onChange={(e) => setOwnerOtpInput(e.target.value.replace(/\D/g, ''))}
                            required
                            autoFocus
                            className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-mono text-center text-2xl font-black tracking-widest"
                          />
                        </div>

                        {ownerAuthError && (
                          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-center gap-2">
                            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                            <span>{ownerAuthError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ShieldCheck size={18} />
                          <span>Verify OTP &amp; Access Dashboard ➔</span>
                        </button>

                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOwnerOtpStep('email')
                              setOwnerOtpInput('')
                              setOwnerAuthError('')
                            }}
                            className="text-blue-600 hover:underline font-bold"
                          >
                            ← Change Email
                          </button>
                          <button
                            type="button"
                            onClick={handleSendOwnerOtp}
                            className="text-slate-500 hover:text-slate-800 font-bold"
                          >
                            Resend Code
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              ) : (
                /* OWNER DASHBOARD: FLEET MANAGEMENT & PIN ADMINISTRATION */
                <div className="owner-dashboard space-y-6">
                  {/* Dashboard Header */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow">
                        🏢
                      </span>
                      <div>
                        <h2 className="text-xl font-black text-slate-900 m-0">
                          {ownerAgencyName}
                        </h2>
                        <span className="text-xs font-semibold text-slate-500">
                          Fleet Control Console • Authenticated Owner: <strong>{ownerEmail}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddBusModal(!showAddBusModal)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={16} />
                        <span>Add New Bus to Fleet</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOwnerAuthenticated(false)
                          setOwnerOtpStep('email')
                          setOwnerOtpInput('')
                        }}
                        className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Sign Out of Owner Console"
                      >
                        <LogOut size={18} />
                      </button>
                    </div>
                  </div>

                  {ownerNotice && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span>{ownerNotice}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOwnerNotice('')}
                        className="text-emerald-700 hover:text-emerald-900 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* KPI Stat Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                      <span className="text-slate-400 uppercase text-[10px] font-black block">Fleet Registered</span>
                      <strong className="text-2xl font-black text-slate-900">{ownerBuses.length || Object.keys(liveBuses).length} Buses</strong>
                      <span className="text-[11px] text-slate-500 block mt-0.5">NH-66 Coastal Network</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                      <span className="text-slate-400 uppercase text-[10px] font-black block">Active on Shift</span>
                      <strong className="text-2xl font-black text-emerald-600">
                        {ownerBuses.filter(b => b.speed > 0 || b.active_shift).length || 2} Streaming
                      </strong>
                      <span className="text-[11px] text-emerald-700 block mt-0.5">Live GPS Broadcasting</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                      <span className="text-slate-400 uppercase text-[10px] font-black block">Total Fleet Capacity</span>
                      <strong className="text-2xl font-black text-blue-700">
                        {(ownerBuses.length || 4) * 42} Passengers
                      </strong>
                      <span className="text-[11px] text-blue-600 block mt-0.5">42 Seats Per Vehicle</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                      <span className="text-slate-400 uppercase text-[10px] font-black block">PIN Security</span>
                      <strong className="text-2xl font-black text-indigo-700">100% Protected</strong>
                      <span className="text-[11px] text-slate-500 block mt-0.5">Unique 4-Digit Conductor PINs</span>
                    </div>
                  </div>

                  {/* Add New Bus Modal / Form */}
                  {showAddBusModal && (
                    <div className="bg-white border-2 border-blue-600 rounded-2xl p-6 shadow-lg space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 m-0">
                            Register New Bus to Your Fleet
                          </h3>
                          <p className="text-xs text-slate-500 m-0">
                            Deploy vehicle to Karavali-Transit and assign conductor secret PIN.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddBusModal(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <form onSubmit={handleAddNewBusToFleet} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Bus Operator Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Vishal Tourist"
                            value={newBusForm.bus_name}
                            onChange={(e) => setNewBusForm({ ...newBusForm, bus_name: e.target.value })}
                            required
                            className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Vehicle Registration Number</label>
                          <input
                            type="text"
                            placeholder="e.g. KA-20-A-1234"
                            value={newBusForm.vehicle_number}
                            onChange={(e) => setNewBusForm({ ...newBusForm, vehicle_number: e.target.value })}
                            required
                            className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-extrabold uppercase tracking-wide"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Route Number</label>
                          <input
                            type="text"
                            placeholder="e.g. 15, NH-66"
                            value={newBusForm.route_number}
                            onChange={(e) => setNewBusForm({ ...newBusForm, route_number: e.target.value })}
                            required
                            className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Service Category</label>
                          <select
                            value={newBusForm.service_type}
                            onChange={(e) => setNewBusForm({ ...newBusForm, service_type: e.target.value })}
                            className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-none bg-white font-bold"
                          >
                            <option value="Express">⚡ Express Service</option>
                            <option value="City / Ordinary">🚌 City / Ordinary Service</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Corridor Origin</label>
                          <input
                            type="text"
                            placeholder="e.g. Mangaluru Statebank"
                            value={newBusForm.origin}
                            onChange={(e) => setNewBusForm({ ...newBusForm, origin: e.target.value })}
                            required
                            className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Corridor Destination</label>
                          <input
                            type="text"
                            placeholder="e.g. Surathkal"
                            value={newBusForm.destination}
                            onChange={(e) => setNewBusForm({ ...newBusForm, destination: e.target.value })}
                            required
                            className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-bold"
                          />
                        </div>

                        {/* Secret PIN Generator */}
                        <div className="space-y-1 md:col-span-3 bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
                          <div className="flex items-center justify-between">
                            <label className="font-extrabold text-blue-900 flex items-center gap-1.5">
                              <KeyRound size={15} className="text-blue-700" />
                              <span>Secret Conductor PIN (4 Digits)</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setNewBusForm({ ...newBusForm, conductor_pin: Math.floor(1000 + Math.random() * 9000).toString() })}
                              className="text-blue-700 hover:text-blue-900 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw size={12} />
                              <span>Randomize PIN</span>
                            </button>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <input
                              type="text"
                              maxLength={4}
                              value={newBusForm.conductor_pin}
                              onChange={(e) => setNewBusForm({ ...newBusForm, conductor_pin: e.target.value.replace(/\D/g, '') })}
                              required
                              className="w-36 p-2 rounded-lg border border-blue-300 font-mono text-center text-base font-extrabold tracking-widest bg-white"
                            />
                            <span className="text-slate-600 text-[11px]">
                              Give this 4-digit code to your driver/conductor. They enter it on their phone to start their shift.
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-3 flex justify-end gap-2 pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => setShowAddBusModal(false)}
                            className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow"
                          >
                            Save &amp; Deploy to Fleet ➔
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Registered Fleet List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-base font-extrabold text-slate-900 m-0 flex items-center gap-2">
                        <Bus size={18} className="text-blue-600" />
                        <span>Registered Fleet Buses &amp; Conductor Access PINs</span>
                      </h3>
                      <div className="relative text-xs w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search vehicle or route..."
                          value={ownerSearchQuery}
                          onChange={(e) => setOwnerSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold outline-none focus:border-blue-600 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(ownerBuses.length > 0 ? ownerBuses : Object.values(liveBuses))
                        .filter((bus) => {
                          if (!ownerSearchQuery.trim()) return true
                          const q = ownerSearchQuery.toLowerCase()
                          return (
                            bus.bus_name?.toLowerCase().includes(q) ||
                            bus.vehicle_number?.toLowerCase().includes(q) ||
                            bus.route_name?.toLowerCase().includes(q) ||
                            bus.route_number?.toLowerCase().includes(q)
                          )
                        })
                        .map((bus) => {
                        const pin = bus.conductor_pin || '4509'
                        const isPinVisible = Boolean(visiblePins[bus.bus_id])
                        const isCopied = copiedPinBusId === bus.bus_id
                        const isStreaming = bus.speed > 0 || bus.active_shift

                        return (
                          <div key={bus.bus_id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <strong className="text-base font-extrabold text-slate-900">
                                    {bus.bus_name}
                                  </strong>
                                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                    bus.service_type?.toLowerCase().includes('express')
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {bus.service_type || 'Express'}
                                  </span>
                                </div>
                                <span className="text-xs font-extrabold text-blue-700">
                                  {bus.vehicle_number}
                                </span>
                              </div>

                              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                                isStreaming
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`} />
                                <span>{isStreaming ? 'Live On Shift' : 'Depot Idle'}</span>
                              </span>
                            </div>

                            <div className="text-xs text-slate-600">
                              Route #{bus.route_number || '15'} • <strong>{bus.route_name || `${bus.origin} ➔ ${bus.destination}`}</strong>
                            </div>

                            {/* Secret Conductor PIN Box */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                              <div>
                                <span className="text-[10px] uppercase font-extrabold text-slate-400 block">
                                  Secret Conductor PIN
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <strong className="font-mono text-base font-extrabold tracking-widest text-slate-900">
                                    {isPinVisible ? pin : '••••'}
                                  </strong>
                                  <button
                                    type="button"
                                    onClick={() => setVisiblePins({ ...visiblePins, [bus.bus_id]: !isPinVisible })}
                                    className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                                    title={isPinVisible ? 'Hide PIN' : 'Reveal PIN'}
                                  >
                                    {isPinVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(pin)
                                      setCopiedPinBusId(bus.bus_id)
                                      setTimeout(() => setCopiedPinBusId(null), 2000)
                                    }}
                                    className="p-1 text-slate-500 hover:text-blue-700 rounded cursor-pointer"
                                    title="Copy PIN to clipboard"
                                  >
                                    {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBusPin(bus.bus_id, pin)}
                                  className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-blue-700 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition"
                                >
                                  Change PIN
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBus(bus.bus_id, bus.vehicle_number)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                  title="Delete Bus"
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Launch Conductor CTA */}
                            <button
                              type="button"
                              onClick={() => {
                                setConductorVehicleInput(bus.vehicle_number)
                                setConductorPinInput(pin)
                                setRole('conductor')
                              }}
                              className="w-full py-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Radio size={14} />
                              <span>Switch to Conductor Portal for this Bus ➔</span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* LOCATION PERMISSION PROMPT MODAL (FOR STEP 3)                  */}
      {/* Prompts: "Turn on your location to track this bus live"         */}
      {/* ============================================================== */}
      {showLocationModal && pendingBusToTrack && (
        <div className="location-modal-backdrop" role="dialog" aria-modal="true">
          <div className="location-modal-card">
            <div className="modal-icon-halo">
              <Navigation size={28} className="animate-pulse" />
            </div>

            <div>
              <h3 className="location-modal-title">
                Turn on your location to track this bus live
              </h3>
              <p className="location-modal-text mt-2">
                Allow location access so Karavali-Transit can calculate your exact distance to{' '}
                <strong className="text-slate-900">{pendingBusToTrack.bus_name}</strong>, display live arrival countdowns, and draw the direct navigation route line to your stop.
              </p>
            </div>

            <div className="modal-actions-col">
              <button
                type="button"
                onClick={() => handleConfirmLocationAndTrack(true)}
                className="modal-allow-btn flex items-center justify-center gap-2"
              >
                <Compass size={18} />
                <span>Turn On Location &amp; Track Bus</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmLocationAndTrack(false)}
                className="modal-fallback-btn"
              >
                Use Boarding Stop (Statebank Terminal)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLocationModal(false)
                  setPendingBusToTrack(null)
                }}
                className="modal-cancel-btn"
              >
                Cancel &amp; Return to Bus List
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
