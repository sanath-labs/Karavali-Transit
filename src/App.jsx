import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bus,
  CheckCircle2,
  Compass,
  MapPin,
  Navigation,
  Radio,
  Search,
  X,
} from 'lucide-react'
import io from 'socket.io-client'
import './App.css'

const TransitMap = lazy(() => import('./TransitMap.jsx'))

const socket = io('http://localhost:5000')

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

function App() {
  const [role, setRole] = useState('passenger') // 'passenger' | 'conductor'

  // STRICT 3-STEP PASSENGER JOURNEY STATE:
  // Step 1: Destination/Route Selection (Default Landing)
  // Step 2: Filtered Bus List Screen
  // Step 3: Live Tracking Map View
  const [passengerStep, setPassengerStep] = useState(1)
  const [selectedDestination, setSelectedDestination] = useState('Surathkal')
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('All') // 'All' | 'Express' | 'City'

  // Live bus telemetry state
  const [liveBuses, setLiveBuses] = useState(defaultBuses)
  const [selectedBusId, setSelectedBusId] = useState(null)
  const [showLocationModal, setShowLocationModal] = useState(false)
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

  // Conductor state
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
  const [broadcastNotice, setBroadcastNotice] = useState('')
  const latestGpsRef = useRef([12.8997, 74.8530, 38, null])
  const [gpsError, setGpsError] = useState('')
  const watchId = useRef(null)
  const simTimer = useRef(null)

  const phoneInputId = useId()
  const vehicleInputId = useId()
  const busNameInputId = useId()
  const serviceSelectId = useId()
  const routeNumInputId = useId()
  const originInputId = useId()
  const destInputId = useId()
  const crowdSelectId = useId()
  const lastBusCheckId = useId()

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

  // Listen for real-time WebSocket GPS coordinates
  useEffect(() => {
    const handleLocationBroadcast = (data) => {
      setLiveBuses((prev) => ({
        ...prev,
        [data.bus_id]: {
          ...(prev[data.bus_id] || {}),
          ...data,
        },
      }))
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

  // Quick Preset Selection for Drivers
  const applyPreset = (presetName) => {
    if (presetName === 'vishal') {
      setBusData({
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
    } else if (presetName === 'canara') {
      setBusData({
        bus_id: 2,
        driver_phone: '97410 99201',
        vehicle_number: 'KA-20-C-8812',
        bus_name: 'Canara Pinto Deluxe',
        service_type: 'Express',
        route_number: 'NH-66',
        origin: 'Mangaluru Statebank',
        destination: 'Udupi',
        crowd_status: 'Standing Allowed',
        is_last_bus: false,
      })
    } else if (presetName === 'padmambika') {
      setBusData({
        bus_id: 3,
        driver_phone: '94482 11090',
        vehicle_number: 'KA-19-F-3304',
        bus_name: 'Padmambika Local',
        service_type: 'City / Ordinary',
        route_number: '21',
        origin: 'Mangaluru Statebank',
        destination: 'Kuloor',
        crowd_status: 'Seats Available',
        is_last_bus: true,
      })
    } else if (presetName === 'coastal_star') {
      setBusData({
        bus_id: 4,
        driver_phone: '98801 44520',
        vehicle_number: 'KA-19-MC-1022',
        bus_name: 'Coastal Star City',
        service_type: 'City / Ordinary',
        route_number: '15B',
        origin: 'Surathkal',
        destination: 'Mangaluru Statebank',
        crowd_status: 'Seats Available',
        is_last_bus: false,
      })
    }
  }

  // Conductor: Start duty & stream coordinates
  const handleStartShift = (event) => {
    event.preventDefault()
    setGpsError('')

    const fullRoute = `${busData.origin} ➔ ${busData.destination}`

    const broadcast = (lat, lng, speedVal, headingVal = null) => {
      const speed = speedVal === null || speedVal === undefined ? 38 : Math.round(speedVal * 3.6)
      const delayMinutes = speed < 25 ? 4 : 0
      const dist = calculateDistanceKm(passengerCoords[0], passengerCoords[1], lat, lng)
      const dynamicEta = Math.max(1, Math.round((dist / (speed || 38)) * 60))
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
        () => {
          // Automatic corridor waypoint simulation along NH-66 for laptops/desktops
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
          broadcast(waypoints[0][0], waypoints[0][1], 38)
          simTimer.current = setInterval(() => {
            step = (step + 1) % waypoints.length
            broadcast(waypoints[step][0], waypoints[step][1], 42)
          }, 3200)
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 },
      )
    } else {
      broadcast(12.8997, 74.8530, 38)
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

  return (
    <main className="transit-app min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* 1. TOP OFFICIAL GOVERNMENT MICRO-HEADER */}
      <div className="gov-topbar bg-slate-950 text-slate-300 text-xs px-6 py-2 border-b-2 border-blue-600">
        <div className="gov-topbar-content max-w-7xl mx-auto flex items-center justify-between">
          <span className="gov-title font-semibold tracking-wide">
            ಕರ್ನಾಟಕ ಸರ್ಕಾರ • Department of Public Land Transport • Coastal Transit Network
          </span>
          <span className="gov-badge bg-white/10 px-2.5 py-0.5 rounded text-blue-300 text-xs font-semibold">
            Official Passenger Information System (PIS)
          </span>
        </div>
      </div>

      {/* 2. OFFICIAL MAIN APP HEADER */}
      <header className="app-header bg-white border-b border-slate-200 px-6 py-3 shadow-sm flex items-center justify-between gap-4">
        <div className="brand flex items-center gap-3">
          <span className="brand-icon w-11 h-11 rounded-xl bg-gradient-to-br from-blue-900 to-blue-600 text-white flex items-center justify-center shadow-md">
            <Bus size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="app-title text-xl font-extrabold text-slate-900 tracking-tight m-0">
              Karavali Sarige • Transit
            </h1>
            <p className="brand-subtitle text-xs font-semibold text-slate-500 m-0">
              Coastal Karnataka Real-Time Bus Radar (NH-66 Corridor)
            </p>
          </div>
        </div>

        {/* Database & GPS Live Status */}
        <div className="system-status-badge hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-bold text-green-800">
          <span className="status-dot-green w-2 h-2 rounded-full bg-green-600 shadow-sm animate-pulse" />
          <span>{dbStatus ? 'SQL Database Connected' : 'GPS Satellite Live'}</span>
        </div>

        {/* User-Friendly Role Switcher */}
        <nav className="role-switch flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1" aria-label="Switch User Mode">
          <button
            type="button"
            onClick={() => {
              setRole('passenger')
            }}
            className={`role-button px-4 py-2 rounded-lg text-xs font-bold transition-all ${role === 'passenger' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Passenger Live Radar
          </button>
          <button
            type="button"
            onClick={() => setRole('conductor')}
            className={`role-button px-4 py-2 rounded-lg text-xs font-bold transition-all ${role === 'conductor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Staff / Conductor Portal
          </button>
        </nav>
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
                      Where are you traveling today?
                    </h2>
                    <p className="step1-subtitle text-slate-500 text-sm mt-1">
                      Select your destination along the Mangaluru – Surathkal NH-66 corridor.
                    </p>
                  </div>

                  {/* Boarding Stop Indicator */}
                  <div className="boarding-card bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        Your Boarding Station
                      </span>
                      <strong className="text-sm font-extrabold text-slate-900">
                        {passengerLocationName}
                      </strong>
                    </div>
                  </div>

                  {/* 1-Tap Quick Destination Pills */}
                  <div className="quick-filter-group flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Quick Select Destination:
                    </label>
                    <div className="destination-pills-grid grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: 'Surathkal', name: 'Surathkal / NITK', desc: '10.5 km Corridor' },
                        { id: 'Udupi', name: 'Udupi', desc: 'Coastal Express' },
                        { id: 'Kuloor', name: 'Kuloor Bridge', desc: 'City Ordinary' },
                        { id: 'Statebank', name: 'Statebank', desc: 'Central Terminal' },
                        { id: 'All', name: 'All Routes', desc: 'Show All Buses' },
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
                      placeholder="Or search by bus name (e.g., Vishal Express) or Route #..."
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
                    <span>Search Incoming Buses</span>
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
                {/* Header with Back button and count */}
                <div className="step2-nav-header bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPassengerStep(1)}
                      className="step2-back-btn flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      title="Back to Step 1: Change Destination"
                    >
                      <ArrowLeft size={16} />
                      <span>Change Destination</span>
                    </button>
                    <div>
                      <h2 className="step2-destination-title text-base font-extrabold text-slate-900 m-0">
                        Incoming Buses to: <span className="text-blue-600">{selectedDestination === 'All' ? 'All Coastal Corridors' : selectedDestination}</span>
                      </h2>
                      <span className="text-xs text-slate-500">Boarding at {passengerLocationName}</span>
                    </div>
                  </div>

                  <span className="step2-bus-count-badge bg-blue-50 text-blue-700 border border-blue-200 text-xs font-extrabold px-3 py-1 rounded-full">
                    {filteredBuses.length} Active {filteredBuses.length === 1 ? 'Bus' : 'Buses'} Operating
                  </span>
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
                    {filteredBuses.map((bus) => {
                      const isExpress = (bus.service_type || '').toLowerCase().includes('express')
                      const isDelayed = (bus.delay_minutes || 0) > 0

                      return (
                        <article
                          key={bus.bus_id}
                          className="bus-card-simple bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col gap-3"
                        >
                          {/* Top: Route Tag, Name, Service Badge */}
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

                            <span className={`service-badge text-xs font-extrabold px-3 py-1 rounded-full ${isExpress ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                              {isExpress ? '⚡ Express Service' : '🚌 City / Ordinary'}
                            </span>
                          </div>

                          {/* Route Corridor */}
                          <p className="card-route text-xs font-semibold text-slate-600 m-0">
                            Corridor: <span className="text-slate-900 font-bold">{bus.route_name}</span>
                          </p>

                          {/* Highlights: Arrival ETA, Schedule, Delays, Speed */}
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
                              <span className="text-slate-500 font-bold uppercase text-[10px]">Delay Status</span>
                              <strong className={`text-sm font-bold ${isDelayed ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {isDelayed ? `+${bus.delay_minutes}m Late` : 'On Time'}
                              </strong>
                            </div>
                            <div className="highlight-item flex flex-col">
                              <span className="text-slate-500 font-bold uppercase text-[10px]">Live Velocity</span>
                              <strong className="text-slate-900 text-sm font-bold">{bus.speed ?? 38} km/h</strong>
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
              <div className="step3-container flex-1 flex flex-col relative h-[calc(100vh-140px)] min-h-[500px]">
                {/* STEP 3 TOP NAVIGATION BAR WITH "SWITCH BUS / EXIT MAP" BUTTON */}
                <div className="step3-topbar bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4 z-10 shadow-sm">
                  <div className="flex items-center gap-3">
                    {/* CRITICAL FEATURE: "SWITCH BUS / EXIT MAP" BUTTON */}
                    <button
                      type="button"
                      onClick={() => setPassengerStep(2)}
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
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            🛰️ Live GPS Active
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {distanceToPassenger} km away from your stop • {trackedBus.route_name}
                      </span>
                    </div>
                  </div>

                  {/* Live Quick Metrics in Header */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      ETA: {trackedBus.eta_minutes ?? 3} Mins
                    </span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                      {trackedBus.speed ?? 38} km/h
                    </span>
                  </div>
                </div>

                {/* FLOATING HUD ON MAP */}
                <div className="floating-hud absolute top-16 left-4 right-4 z-20 bg-white/95 backdrop-blur-md border border-blue-200 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4 flex-wrap">
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
                    />
                  </Suspense>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================== */
          /* CONDUCTOR / STAFF DUTY PORTAL (SEPARATE VIEW)                  */
          /* ============================================================== */
          <div className="conductor-page flex-1 flex items-center justify-center p-6 bg-slate-50">
            <div className="conductor-box w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              {!isLoggedIn ? (
                <form onSubmit={handleStartShift} className="driver-form flex flex-col gap-4">
                  <div className="form-head text-center">
                    <span className="driver-avatar w-12 h-12 rounded-full bg-blue-100 text-blue-700 mx-auto flex items-center justify-center mb-2">
                      <Radio size={24} />
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight m-0">
                      Staff &amp; Driver Duty Login
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Official Coastal Bus GPS Streaming &amp; Telemetry Portal
                    </p>
                  </div>

                  {/* 1-Click Quick Bus Profiles */}
                  <div className="quick-presets flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="presets-title text-[11px] font-bold text-slate-600 uppercase">
                      Select Scheduled Bus Profile:
                    </span>
                    <div className="preset-buttons grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => applyPreset('vishal')}
                        className={`preset-btn p-2 rounded-lg border text-left transition-all ${busData.bus_name === 'Vishal Express' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
                      >
                        ⚡ Vishal (#15)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('canara')}
                        className={`preset-btn p-2 rounded-lg border text-left transition-all ${busData.bus_name.includes('Canara') ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
                      >
                        ⚡ Canara (NH-66)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('padmambika')}
                        className={`preset-btn p-2 rounded-lg border text-left transition-all ${busData.bus_name.includes('Padmambika') ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
                      >
                        🚌 Padmambika (#21)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('coastal_star')}
                        className={`preset-btn p-2 rounded-lg border text-left transition-all ${busData.bus_name.includes('Coastal Star') ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
                      >
                        🚌 Coastal (#15B)
                      </button>
                    </div>
                  </div>

                  {/* Clean Form Grid */}
                  <div className="form-row-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="input-field flex flex-col gap-1">
                      <label htmlFor={phoneInputId} className="font-bold text-slate-700">Driver / Conductor Phone</label>
                      <input
                        id={phoneInputId}
                        type="tel"
                        value={busData.driver_phone}
                        onChange={(e) => setBusData({ ...busData, driver_phone: e.target.value })}
                        required
                        className="p-2.5 rounded-lg border border-slate-300 focus:border-blue-600 outline-none"
                      />
                    </div>
                    <div className="input-field flex flex-col gap-1">
                      <label htmlFor={vehicleInputId} className="font-bold text-slate-700">Vehicle Registration Number</label>
                      <input
                        id={vehicleInputId}
                        type="text"
                        value={busData.vehicle_number}
                        onChange={(e) => setBusData({ ...busData, vehicle_number: e.target.value })}
                        required
                        className="p-2.5 rounded-lg border border-slate-300 focus:border-blue-600 outline-none"
                      />
                    </div>
                  </div>

                  <div className="form-row-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="input-field flex flex-col gap-1">
                      <label htmlFor={busNameInputId} className="font-bold text-slate-700">Bus Service Name</label>
                      <input
                        id={busNameInputId}
                        type="text"
                        value={busData.bus_name}
                        onChange={(e) => setBusData({ ...busData, bus_name: e.target.value })}
                        required
                        className="p-2.5 rounded-lg border border-slate-300 focus:border-blue-600 outline-none"
                      />
                    </div>
                    <div className="input-field flex flex-col gap-1">
                      <label htmlFor={serviceSelectId} className="font-bold text-slate-700">Service Category</label>
                      <select
                        id={serviceSelectId}
                        value={busData.service_type}
                        onChange={(e) => setBusData({ ...busData, service_type: e.target.value })}
                        className="p-2.5 rounded-lg border border-slate-300 focus:border-blue-600 outline-none bg-white font-bold"
                      >
                        <option value="Express">⚡ Express Service</option>
                        <option value="City / Ordinary">🚌 City / Ordinary Service</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="input-field flex flex-col gap-1">
                      <label htmlFor={routeNumInputId} className="font-bold text-slate-700">Route #</label>
                      <input
                        id={routeNumInputId}
                        type="text"
                        value={busData.route_number}
                        onChange={(e) => setBusData({ ...busData, route_number: e.target.value })}
                        required
                        className="p-2.5 rounded-lg border border-slate-300 focus:border-blue-600 outline-none"
                      />
                    </div>
                    <div className="input-field flex flex-col gap-1">
                      <label htmlFor={originInputId} className="font-bold text-slate-700">Route Origin (From)</label>
                      <input
                        id={originInputId}
                        type="text"
                        value={busData.origin}
                        onChange={(e) => setBusData({ ...busData, origin: e.target.value })}
                        required
                        className="p-2.5 rounded-lg border border-slate-300 focus:border-blue-600 outline-none"
                      />
                    </div>
                    <div className="input-field flex flex-col gap-1">
                      <label htmlFor={destInputId} className="font-bold text-slate-700">Destination (To)</label>
                      <input
                        id={destInputId}
                        type="text"
                        value={busData.destination}
                        onChange={(e) => setBusData({ ...busData, destination: e.target.value })}
                        required
                        className="p-2.5 rounded-lg border border-slate-300 focus:border-blue-600 outline-none"
                      />
                    </div>
                  </div>

                  <div className="form-row-2 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center text-xs">
                    <div className="input-field flex flex-col gap-1">
                      <label htmlFor={crowdSelectId} className="font-bold text-slate-700">Current Seating Load</label>
                      <select
                        id={crowdSelectId}
                        value={busData.crowd_status}
                        onChange={(e) => setBusData({ ...busData, crowd_status: e.target.value })}
                        className="p-2.5 rounded-lg border border-slate-300 focus:border-blue-600 outline-none bg-white font-bold"
                      >
                        <option value="Seats Available">🟢 Seats Available</option>
                        <option value="Standing Allowed">🟡 Standing Allowed</option>
                        <option value="Overcrowded">🔴 Full Capacity</option>
                      </select>
                    </div>

                    <label htmlFor={lastBusCheckId} className="checkbox-item flex items-center gap-2 font-bold text-rose-800 bg-rose-50 p-2.5 rounded-lg border border-rose-200 cursor-pointer mt-4 sm:mt-0">
                      <input
                        type="checkbox"
                        id={lastBusCheckId}
                        checked={busData.is_last_bus}
                        onChange={(e) => setBusData({ ...busData, is_last_bus: e.target.checked })}
                        className="w-4 h-4 text-rose-600"
                      />
                      <span>Mark as Night Last Bus</span>
                    </label>
                  </div>

                  {gpsError && <p className="gps-warning-text text-rose-600 text-xs font-bold">{gpsError}</p>}

                  <button
                    type="submit"
                    className="start-shift-btn w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-3 px-6 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Navigation size={18} />
                    <span>Start Shift &amp; Stream GPS</span>
                  </button>
                </form>
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
                      GPS coordinates are broadcasting live to passengers on Karavali Sarige radar.
                    </p>
                  </div>

                  <div className="shift-summary-grid grid grid-cols-2 gap-2 text-left bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Bus Service</span>
                      <strong className="text-slate-900 font-extrabold">{busData.bus_name} (#{busData.route_number})</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Corridor</span>
                      <strong className="text-slate-900 font-extrabold">{busData.origin} ➔ {busData.destination}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Registration</span>
                      <strong className="text-slate-900 font-extrabold">{busData.vehicle_number}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Database Sync</span>
                      <strong className="text-emerald-700 font-extrabold">💾 Logged in transit.db</strong>
                    </div>
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
