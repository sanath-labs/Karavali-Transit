import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building,
  Bus,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Copy,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  Menu,
  Home,
  Headphones,
  MessageSquare,
  Phone,
  Languages,
  Clock,
  Users,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Printer,
  Radio,
  Search,
  Share2,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import io from 'socket.io-client'
import { translations } from './translations.js'
import { calculateEstimatedFare, sortBuses } from './fareRules.js'
import { generateShiftSummary } from './shiftLedger.js'
import { apiUrl, socketUrl } from './api.js'
import { matchesDestination } from './transitUtils.js'
import OwnerPortal from './OwnerPortal.jsx'
import './App.css'

const TransitMap = lazy(() => import('./TransitMap.jsx'))

const socket = io(socketUrl)

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [utilityPage, setUtilityPage] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)

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

  useEffect(() => {
    if (!menuOpen && !utilityPage && !searchFocused) return undefined
    const handleOverlayEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setUtilityPage('')
        setSearchFocused(false)
        setActiveSuggestionIndex(-1)
      }
    }
    window.addEventListener('keydown', handleOverlayEscape)
    return () => window.removeEventListener('keydown', handleOverlayEscape)
  }, [menuOpen, utilityPage, searchFocused])

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
  const [passengerStep, setPassengerStep] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const busParam = new URLSearchParams(window.location.search).get('bus')
        if (busParam) return 3
      }
    } catch {}
    return 1
  })
  const [isAudioChimeEnabled, setIsAudioChimeEnabled] = useState(true)
  const hasChimededForBusRef = useRef(null)
  const [selectedDestination, setSelectedDestination] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const destParam = new URLSearchParams(window.location.search).get('dest')
        if (destParam) return destParam
      }
    } catch {}
    return 'Surathkal'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('All') // 'All' | 'Express' | 'City'
  const [sortBy, setSortBy] = useState('eta') // 'eta' | 'fare' | 'seats'

  // Live bus telemetry state
  const [liveBuses, setLiveBuses] = useState(defaultBuses)
  const [selectedBusId, setSelectedBusId] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const busParam = new URLSearchParams(window.location.search).get('bus')
        if (busParam) {
          const num = Number(busParam)
          return isNaN(num) ? busParam : num
        }
      }
    } catch {}
    return null
  })
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [isFullscreenMap, setIsFullscreenMap] = useState(false)
  const [pendingBusToTrack, setPendingBusToTrack] = useState(null)
  const [copiedLink, setCopiedLink] = useState(false)

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
    crowd_status: 'Seats Available',
    is_last_bus: false,
  })
  const [conductorPassengerCount, setConductorPassengerCount] = useState(24)
  const [shiftStartTime, setShiftStartTime] = useState(null)
  const [showShiftSummaryModal, setShowShiftSummaryModal] = useState(false)
  const [shiftReportData, setShiftReportData] = useState(null)
  const [broadcastNotice, setBroadcastNotice] = useState('')
  const latestGpsRef = useRef([12.8997, 74.8530, 38, null])
  const [gpsError, setGpsError] = useState('')
  const watchId = useRef(null)
  const simTimer = useRef(null)
  const lastEmitTimeRef = useRef(0)
  const lastSentCoordsRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

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

  // Periodic heartbeat timer for telemetry freshness checks
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  // Check SQL database connection on mount
  useEffect(() => {
    fetch(apiUrl('/api/health'))
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
      const res = await fetch(apiUrl('/api/conductor/verify-pin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_number: conductorVehicleInput,
          conductor_pin: conductorPinInput,
          driver_phone: conductorPhoneInput || '98451 23456',
        }),
      })
      const data = await res.json()

      if (res.ok && data.success && data.bus) {
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
    } catch (error) {
      setConductorAuthError(`Could not contact the transit server: ${error.message}`)
    } finally {
      setIsCheckingPin(false)
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

    if (!shiftStartTime) {
      setShiftStartTime(Date.now())
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

    const report = generateShiftSummary({
      busName: busData.bus_name,
      vehicleNumber: busData.vehicle_number,
      routeNumber: busData.route_number || '15',
      serviceType: busData.service_type || 'Express',
      origin: busData.origin || 'Mangaluru Statebank',
      destination: busData.destination || 'Surathkal',
      startTime: shiftStartTime || (Date.now() - 7200000),
      endTime: Date.now(),
      currentPassengers: conductorPassengerCount,
    })
    setShiftReportData(report)
    setShowShiftSummaryModal(true)
    setIsLoggedIn(false)
    setShiftStartTime(null)
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
    if (!matchesDestination(bus, selectedDestination)) return false

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

  // 1-Tap WhatsApp Share Trip Handler
  const handleShareTripWhatsApp = () => {
    if (!trackedBus || typeof window === 'undefined') return
    const origin = window.location.origin
    const shareUrl = `${origin}/?bus=${trackedBus.bus_id}&dest=${encodeURIComponent(selectedDestination)}`
    const distText = distanceToPassenger !== null ? `${distanceToPassenger} km away` : 'approaching'
    const etaText = `${trackedBus.eta_minutes ?? 3} mins`
    const message = `🚍 *Karavali Sarige Live Transit Track*\nBus: *${trackedBus.bus_name}* (${trackedBus.vehicle_number})\nRoute: ${trackedBus.route_name}\nStop ETA: ${etaText} (${distText})\n\n📍 Open Live Radar:\n${shareUrl}`
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  // 1-Tap Copy Trip Link Handler
  const handleCopyTripLink = async () => {
    if (!trackedBus || typeof window === 'undefined') return
    const origin = window.location.origin
    const shareUrl = `${origin}/?bus=${trackedBus.bus_id}&dest=${encodeURIComponent(selectedDestination)}`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      }
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

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
      {/* Passenger landing header / existing operational header */}
      {role === 'passenger' && passengerStep === 1 ? (
        <header className="landing-header">
          <button className="landing-brand" type="button" onClick={() => { setRole('passenger'); setPassengerStep(1); setMenuOpen(false) }} aria-label="Karavali-Transit home">
            <span className="landing-brand-icon"><Bus size={42} strokeWidth={2.4} /></span>
            <span className="landing-brand-copy">
              <span className="landing-brand-title">Karavali-<strong>Transit</strong></span>
              <span className="landing-brand-subtitle">Private Bus Live Tracking</span>
            </span>
          </button>
          <div className="landing-header-actions">
            <button type="button" className="landing-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="passenger-navigation-menu">
              {menuOpen ? <X size={28} /> : <Menu size={30} />}
            </button>
          </div>
          {menuOpen && (
            <>
              <button type="button" className="landing-menu-backdrop" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />
              <nav id="passenger-navigation-menu" className="landing-navigation-menu" aria-label="Main navigation">
                <div className="landing-menu-heading">
                  <span>Karavali-Transit</span>
                  <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button>
                </div>
                <button type="button" className="landing-menu-item" onClick={() => { setRole('passenger'); setPassengerStep(1); setUtilityPage(''); setMenuOpen(false) }}><Home size={19} /><span>Home</span></button>
                <button type="button" className="landing-menu-item" onClick={() => { setRole('passenger'); setSelectedDestination('All'); setSearchQuery(''); setPassengerStep(2); setUtilityPage(''); setMenuOpen(false) }}><Bus size={19} /><span>Passenger Radar</span></button>
                <div className="landing-menu-divider" />
                <button type="button" className="landing-menu-item" onClick={() => { setRole('conductor'); setUtilityPage(''); setMenuOpen(false) }}><Radio size={19} /><span>Conductor Login</span></button>
                <button type="button" className="landing-menu-item" onClick={() => { setRole('owner'); setUtilityPage(''); setMenuOpen(false) }}><Building size={19} /><span>Fleet Owner Login</span></button>
                <div className="landing-menu-divider" />
                <button type="button" className="landing-menu-item" onClick={() => { setUtilityPage('Helpdesk'); setMenuOpen(false) }}><Headphones size={19} /><span>Helpdesk</span></button>
                <button type="button" className="landing-menu-item" onClick={() => { setUtilityPage('Feedback'); setFeedbackSent(false); setMenuOpen(false) }}><MessageSquare size={19} /><span>Feedback</span></button>
                <button type="button" className="landing-menu-item" onClick={() => { setUtilityPage('Contact Us'); setMenuOpen(false) }}><Phone size={19} /><span>Contact Us</span></button>
                <div className="landing-menu-divider" />
                <button type="button" className="landing-menu-item" onClick={() => { toggleLanguage(); setMenuOpen(false) }}><Languages size={19} /><span>{lang === 'en' ? 'ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಿ (Kannada)' : 'Switch to English'}</span></button>
              </nav>
            </>
          )}
        </header>
      ) : (
        <>
          <div className="gov-topbar bg-slate-950 text-slate-300 text-xs px-6 py-2 border-b-2 border-blue-600">
            <div className="gov-topbar-content max-w-7xl mx-auto flex items-center justify-between">
              <span className="gov-title font-semibold tracking-wide">{t.govTitle}</span>
              <span className="gov-badge bg-white/10 px-2.5 py-0.5 rounded text-blue-300 text-xs font-semibold">{t.govBadge}</span>
            </div>
          </div>
          <header className="app-header bg-white border-b border-slate-200 px-6 py-3 shadow-sm flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="brand flex items-center gap-3">
              <span className="brand-icon w-11 h-11 rounded-xl bg-gradient-to-br from-blue-900 to-blue-600 text-white flex items-center justify-center shadow-md shrink-0"><Bus size={22} aria-hidden="true" /></span>
              <div>
                <h1 className="app-title text-xl font-extrabold text-slate-900 tracking-tight m-0">{t.appTitle}</h1>
                <p className="brand-subtitle text-xs font-semibold text-slate-500 m-0">{t.brandSubtitle}</p>
              </div>
            </div>
            <div className="system-status-badge hidden lg:flex items-center gap-2 px-3.5 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-bold text-green-800">
              <span className="status-dot-green w-2 h-2 rounded-full bg-green-600 shadow-sm animate-pulse" /><span>{dbStatus ? t.dbConnected : t.gpsLive}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={toggleLanguage} className="lang-toggle-btn px-3 py-1.5 rounded-xl border border-slate-300 hover:border-blue-600 bg-white hover:bg-blue-50 text-slate-800 font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer" title={lang === 'en' ? 'ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಿ' : 'Switch to English'}><span className="text-sm">🌐</span><span>{t.langToggle}</span></button>
              <nav className="role-switch flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1" aria-label="Switch User Mode">
                <button type="button" onClick={() => setRole('passenger')} className={`role-button px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${role === 'passenger' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><Bus size={15} /><span>{t.passengerRadar}</span></button>
                <button type="button" onClick={() => setRole('conductor')} className={`role-button px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${role === 'conductor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><Radio size={15} /><span>{t.conductorTerminal}</span></button>
                <button type="button" onClick={() => setRole('owner')} className={`role-button px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${role === 'owner' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><Building size={15} /><span>{t.fleetOwner}</span></button>
              </nav>
            </div>
          </header>
        </>
      )}

      {utilityPage && (
        <div className="landing-utility-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUtilityPage('') }}>
          <section className="landing-utility-modal" role="dialog" aria-modal="true" aria-labelledby="utility-page-title">
            <div className="landing-utility-title-row">
              <h2 id="utility-page-title">{utilityPage}</h2>
              <button type="button" onClick={() => setUtilityPage('')} aria-label="Close dialog"><X size={22} /></button>
            </div>
            {utilityPage === 'Helpdesk' && <div className="landing-utility-content"><p>Need help using Karavali-Transit?</p><ul><li>Choose a destination or search for a bus.</li><li>Select a bus from the incoming-bus list.</li><li>Use the live tracking map to follow the selected bus.</li><li>For conductor or fleet access, use the corresponding login option.</li></ul><p className="landing-utility-note">If you encounter a technical issue, use Contact Us to reach the project support team.</p></div>}
            {utilityPage === 'Contact Us' && <div className="landing-utility-content"><p>Karavali-Transit Passenger Support</p><p>For assistance with destination search, bus tracking, conductor access, or fleet-owner access, contact your transit system administrator.</p><p className="landing-utility-note">A verified support phone number or email address has not been configured in this project. Add the official contact details before publishing.</p></div>}
            {utilityPage === 'Feedback' && (feedbackSent ? <div className="landing-utility-content"><p className="feedback-success"><CheckCircle2 size={20} /> Thank you for your feedback.</p><p className="landing-utility-note">This confirmation is local to this screen. Connect a feedback API to store submissions on the server.</p></div> : <form className="landing-feedback-form" onSubmit={(event) => { event.preventDefault(); if (feedbackMessage.trim()) setFeedbackSent(true) }}><label htmlFor="landing-feedback-message">Tell us about your experience</label><textarea id="landing-feedback-message" value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} rows={4} placeholder="Write your feedback..." required /><button type="submit">Submit Feedback</button><p className="landing-utility-note">Feedback is not sent to a server yet; connect an API to persist it.</p></form>)}
          </section>
        </div>
      )}

      {/* 3. ROTATING PASSENGER ADVISORY TICKER */}
      {alerts.length > 0 && role === 'passenger' && passengerStep !== 1 && (
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
            {passengerStep !== 1 && <nav className="step-progress-nav bg-white border-b border-slate-200 py-2.5 px-4 flex items-center justify-center gap-2 text-xs font-bold">
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
            </nav>}

            {/* ============================================================== */}
            {/* STEP 1: DESTINATION & ROUTE SELECTION (DEFAULT LANDING)        */}
            {/* NO map or bus list visible at this stage                        */}
            {/* ============================================================== */}
            {passengerStep === 1 && (() => {
              const destinationOptions = [
                { label: 'Mangaluru Central', sublabel: 'Statebank Central Terminal', destination: 'Statebank', type: 'destination', emoji: '🌴' },
                { label: 'Surathkal NITK', sublabel: 'Coastal corridor', destination: 'Surathkal', type: 'destination', emoji: '🌊' },
                { label: 'Kuloor KSRTC', sublabel: 'Kuloor Bridge / Highway', destination: 'Kuloor', type: 'destination', emoji: '🌉' },
                { label: 'Udupi City', sublabel: 'Coastal Express', destination: 'Udupi', type: 'destination', emoji: '🛕' },
                { label: 'All Routes', sublabel: 'Show buses on all routes', destination: 'All', type: 'destination', emoji: '🚌' },
              ]

              const busOptions = Object.values(liveBuses || {})
                .filter((bus) => bus && (bus.bus_name || bus.route_number))
                .map((bus) => ({
                  label: bus.bus_name || `Route ${bus.route_number}`,
                  sublabel: `${bus.route_number ? `Route ${bus.route_number} · ` : ''}${bus.destination || 'Coastal corridor'}`,
                  destination: bus.destination || 'All',
                  type: 'bus',
                  emoji: '🚌',
                }))

              const allOptions = [...destinationOptions, ...busOptions]
              const normalizedQuery = searchQuery.trim().toLowerCase()
              const matches = (option) => !normalizedQuery || `${option.label} ${option.sublabel}`.toLowerCase().includes(normalizedQuery)
              const uniqueOptions = allOptions.filter((option, index, arr) => arr.findIndex((candidate) => candidate.label.toLowerCase() === option.label.toLowerCase()) === index)
              const visibleSuggestions = uniqueOptions.filter(matches).slice(0, 6)

              const handleSelectSuggestion = (option) => {
                if (option.type === 'destination') {
                  setSelectedDestination(option.destination)
                  setSearchQuery('')
                } else {
                  setSelectedDestination(option.destination || 'All')
                  setSearchQuery(option.label)
                }
                setSearchFocused(false)
                setActiveSuggestionIndex(-1)
                setPassengerStep(2)
              }

              const handleSearchSubmit = (event) => {
                event.preventDefault()
                if (activeSuggestionIndex >= 0 && activeSuggestionIndex < visibleSuggestions.length) {
                  handleSelectSuggestion(visibleSuggestions[activeSuggestionIndex])
                  return
                }

                const query = searchQuery.trim().toLowerCase()
                const destinationMatch = [
                  { id: 'Statebank', terms: ['mangaluru', 'mangalore', 'central', 'statebank', 'state bank'] },
                  { id: 'Surathkal', terms: ['surathkal', 'nitk'] },
                  { id: 'Kuloor', terms: ['kuloor', 'ksrtc', 'kulur'] },
                  { id: 'Udupi', terms: ['udupi'] },
                  { id: 'All', terms: ['all routes', 'all buses', 'all'] },
                ].find((destination) => destination.terms.some((term) => query.includes(term)))

                if (destinationMatch) {
                  setSelectedDestination(destinationMatch.id)
                  setSearchQuery('')
                }
                setSearchFocused(false)
                setActiveSuggestionIndex(-1)
                handleInitiateSearch(event)
              }

              return (
                <div className="passenger-landing-page">
                  <section className="landing-hero">
                    <div className="landing-hero-art" aria-hidden="true" />
                    <div className="landing-hero-content">
                      <h2>
                        {lang === 'kn' ? (
                          <>ನೀವು ಎಲ್ಲಿಗೆ<br />ಹೋಗಲು ಬಯಸುತ್ತೀರಿ?</>
                        ) : (
                          <>Where do you<br />want to go?</>
                        )}
                      </h2>
                    </div>

                    <form className="landing-search-form" onSubmit={handleSearchSubmit}>
                      <Search className="landing-search-icon" size={24} aria-hidden="true" />
                      <input
                        type="search"
                        autoComplete="off"
                        placeholder={lang === 'kn' ? 'ಗಮ್ಯಸ್ಥಾನ ಅಥವಾ ಬಸ್ ಹೆಸರನ್ನು ಹುಡುಕಿ...' : 'Search destination or bus name...'}
                        value={searchQuery}
                        onFocus={() => {
                          setSearchFocused(true)
                          setActiveSuggestionIndex(-1)
                        }}
                        onChange={(event) => {
                          setSearchQuery(event.target.value)
                          setSearchFocused(true)
                          setActiveSuggestionIndex(-1)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setSearchFocused(false)
                            setActiveSuggestionIndex(-1)
                          } else if (event.key === 'ArrowDown') {
                            event.preventDefault()
                            setActiveSuggestionIndex((prev) => (prev + 1) % (visibleSuggestions.length || 1))
                          } else if (event.key === 'ArrowUp') {
                            event.preventDefault()
                            setActiveSuggestionIndex((prev) => (prev <= 0 ? (visibleSuggestions.length || 1) - 1 : prev - 1))
                          }
                        }}
                        aria-label="Search destination or bus name"
                        aria-expanded={searchFocused}
                        aria-controls="landing-search-suggestions"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className="landing-clear-search"
                          aria-label="Clear search"
                          onClick={() => {
                            setSearchQuery('')
                            setActiveSuggestionIndex(-1)
                          }}
                        >
                          <X size={18} />
                        </button>
                      )}
                      <button type="submit" className="landing-search-submit" aria-label="Search buses">
                        <ArrowRight size={24} />
                      </button>

                      {searchFocused && (
                        <div className="landing-search-suggestions" id="landing-search-suggestions" role="listbox" aria-label="Suggested destinations and buses">
                          <div className="suggestion-section-label">
                            {searchQuery ? 'Matching destinations and buses' : 'Popular destinations'}
                          </div>
                          {visibleSuggestions.length ? (
                            visibleSuggestions.map((option, index) => (
                              <button
                                type="button"
                                role="option"
                                aria-selected={activeSuggestionIndex === index}
                                className={`landing-suggestion-option ${activeSuggestionIndex === index ? 'is-active' : ''}`}
                                key={`${option.type}-${option.label}`}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleSelectSuggestion(option)}
                              >
                                <span className="suggestion-emoji">{option.emoji}</span>
                                <span className="suggestion-copy">
                                  <strong>{option.label}</strong>
                                  <small>{option.sublabel}</small>
                                </span>
                                <ChevronRight size={18} />
                              </button>
                            ))
                          ) : (
                            <p className="landing-no-suggestions">No matching destination or bus. Press the arrow to search all buses.</p>
                          )}
                        </div>
                      )}
                    </form>
                    {searchFocused && (
                      <button
                        className="landing-suggestion-dismiss"
                        type="button"
                        aria-label="Close search suggestions"
                        onClick={() => {
                          setSearchFocused(false)
                          setActiveSuggestionIndex(-1)
                        }}
                      />
                    )}
                  </section>

                  <section className="landing-destinations-section">
                    <div className="landing-section-heading">
                      <h2>{lang === 'kn' ? 'ಜನಪ್ರಿಯ ತಾಣಗಳು' : 'Popular Destinations'}</h2>
                      <button
                        type="button"
                        className="landing-view-all"
                        onClick={() => {
                          setSelectedDestination('All')
                          setSearchQuery('')
                          setPassengerStep(2)
                        }}
                      >
                        <span>View All</span>
                        <ArrowRight size={17} />
                      </button>
                    </div>
                    <div className="landing-destination-grid">
                      {[
                        { id: 'Statebank', title: 'Mangaluru', subtitle: 'Central', image: '/images/destination-mangaluru.jpg', scene: 'mangaluru', alt: 'Mangaluru Central' },
                        { id: 'Surathkal', title: 'Surathkal', subtitle: 'NITK', image: '/images/destination-surathkal.jpg', scene: 'surathkal', alt: 'Surathkal NITK' },
                        { id: 'Kuloor', title: 'Kuloor', subtitle: 'KSRTC', image: '/images/destination-kuloor.jpg', scene: 'kuloor', alt: 'Kuloor KSRTC' },
                        { id: 'Udupi', title: 'Udupi', subtitle: 'City', image: '/images/destination-udupi.jpg', scene: 'udupi', alt: 'Udupi City' },
                      ].map((destination) => (
                        <button
                          type="button"
                          key={destination.id}
                          className={`landing-destination-card ${selectedDestination === destination.id ? 'is-selected' : ''}`}
                          onClick={() => {
                            setSelectedDestination(destination.id)
                            setSearchQuery('')
                            setSearchFocused(false)
                            setPassengerStep(2)
                          }}
                          aria-label={`View buses to ${destination.title} ${destination.subtitle}`}
                        >
                          <span className={`destination-scene scene-${destination.scene}`} aria-hidden="true">
                            <img src={destination.image} alt={destination.alt} loading="lazy" />
                          </span>
                          <strong>{destination.title}</strong>
                          <span className="destination-subtitle">{destination.subtitle}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="landing-feature-strip" aria-label="Karavali-Transit features">
                    <div className="landing-feature">
                      <span className="landing-feature-icon"><Clock size={32} /></span>
                      <strong>Live Tracking</strong>
                      <small>Real-time</small>
                    </div>
                    <div className="landing-feature">
                      <span className="landing-feature-icon"><Users size={32} /></span>
                      <strong>Private Buses</strong>
                      <small>All Operators</small>
                    </div>
                    <div className="landing-feature">
                      <span className="landing-feature-icon"><MapPin size={32} fill="currentColor" /></span>
                      <strong>Easy to Use</strong>
                      <small>No Registration</small>
                    </div>
                  </section>
                </div>
              )
            })()}

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

                  {/* LIVE TRIP SHARING BAR (WHATSAPP & DEEP-LINK) */}
                  <div className="w-full pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <Share2 size={13} className="text-blue-600" />
                      <span>Share live bus arrival with family:</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyTripLink}
                        title="Copy Live Tracking URL to clipboard"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1.5 transition-all border border-slate-200/80 cursor-pointer"
                      >
                        {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShareTripWhatsApp}
                        title="Share live tracking radar link directly via WhatsApp"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        <span>💬</span>
                        <span>Share on WhatsApp</span>
                      </button>
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

              {/* CONDUCTOR SHIFT SUMMARY & REVENUE REPORT MODAL */}
              {showShiftSummaryModal && shiftReportData && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                          <FileText size={20} />
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                            Government of Karnataka • Transit Waybill
                          </span>
                          <h3 className="text-lg font-black text-slate-900 m-0">
                            Conductor Duty Settlement
                          </h3>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowShiftSummaryModal(false)}
                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                        title="Close Receipt"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Receipt Details Box */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div>
                          <strong className="text-sm font-black text-slate-900 block">{shiftReportData.busName}</strong>
                          <span className="text-slate-500 font-semibold">{shiftReportData.vehicleNumber} • Route #{shiftReportData.routeNumber}</span>
                        </div>
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase">
                          {shiftReportData.waybillId}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Duty Corridor</span>
                          <strong className="text-slate-800 font-bold">{shiftReportData.route}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Duty Duration</span>
                          <strong className="text-slate-800 font-bold">{shiftReportData.durationFormatted} ({shiftReportData.startTime} - {shiftReportData.endTime})</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Commuters Served</span>
                          <strong className="text-blue-700 text-sm font-black">{shiftReportData.totalPassengers} Passengers</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Distance Traversed</span>
                          <strong className="text-slate-800 font-bold">{shiftReportData.distanceKm} km (NH-66)</strong>
                        </div>
                      </div>

                      {/* Revenue Highlight */}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between bg-emerald-50 text-emerald-950 p-3 rounded-xl border border-emerald-200">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-700 block">Estimated Revenue Collection</span>
                          <span className="text-xs text-emerald-600 font-semibold">{shiftReportData.serviceType} @ ₹{shiftReportData.avgFare} avg fare</span>
                        </div>
                        <strong className="text-xl font-black text-emerald-700">₹{shiftReportData.estimatedRevenue.toLocaleString()}</strong>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex-1 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Printer size={15} />
                        <span>Print Waybill</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowShiftSummaryModal(false)}
                        className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer text-center"
                      >
                        Complete Check-Out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* FLEET OWNER COMMAND CENTER (EXACT DESIGN IMPLEMENTATION)       */
          /* ============================================================== */
          <OwnerPortal
            ownerEmail={ownerEmail}
            setOwnerEmail={setOwnerEmail}
            ownerAgencyName={ownerAgencyName}
            setOwnerAgencyName={setOwnerAgencyName}
            isOwnerAuthenticated={isOwnerAuthenticated}
            setIsOwnerAuthenticated={setIsOwnerAuthenticated}
            ownerToken={ownerToken}
            setOwnerToken={setOwnerToken}
            onSwitchToConductor={(vehicleNumber, pin) => {
              setConductorVehicleInput(vehicleNumber)
              setConductorPinInput(pin)
              setRole('conductor')
            }}
          />
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
