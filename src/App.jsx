import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
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

// Preloaded realistic coastal buses for instant demo & review
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
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // 1. Conductor / Staff State
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

  // 2. Passenger State
  const [liveBuses, setLiveBuses] = useState(defaultBuses)
  const [destinationFilter, setDestinationFilter] = useState('All')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('All') // 'All' | 'Express' | 'City'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBusId, setSelectedBusId] = useState(1) // Default to Vishal Express for immediate tracking
  const [dbStatus, setDbStatus] = useState(false)
  const [alerts, setAlerts] = useState([
    { id: 1, message: '📢 Passenger Notice: NH-66 Coastal Corridor live GPS tracking active. Traffic congestion near Nanthoor (+4 min delay).' },
    { id: 2, message: '🌙 Night Transit Notice: Padmambika (Route 21) is operating as the Last Bus to Kuloor tonight.' },
  ])
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0)
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
      .then((data) => setDbStatus(Boolean(data?.sql_connected || data?.postgres_connected)))
      .catch(() => setDbStatus(false))
  }, [])

  // Cycle alerts every 7 seconds
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

    socket.on('live_location_broadcast', handleLocationBroadcast)
    socket.on('emergency_alert', handleEmergencyAlert)
    return () => {
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

    const broadcast = (lat, lng, speedVal) => {
      const speed = speedVal === null || speedVal === undefined ? 38 : Math.round(speedVal * 3.6)
      const delayMinutes = speed < 25 ? 4 : 0

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
        speed,
        delay_minutes: delayMinutes,
        eta_minutes: 3,
        estimated_arrival: '1:15 PM',
        crowd_status: busData.crowd_status,
        is_last_bus: busData.is_last_bus,
      })
    }

    if ('geolocation' in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          broadcast(position.coords.latitude, position.coords.longitude, position.coords.speed)
        },
        () => {
          // Automatic smooth simulation along coastal corridor for desktop/laptop testing
          let step = 0
          const waypoints = [
            [12.8718, 74.8430],
            [12.8850, 74.8450],
            [12.8970, 74.8480],
            [12.8997, 74.8530],
            [12.9271, 74.8415],
            [12.9472, 74.7963],
          ]
          broadcast(waypoints[0][0], waypoints[0][1], 38)
          simTimer.current = setInterval(() => {
            step = (step + 1) % waypoints.length
            broadcast(waypoints[step][0], waypoints[step][1], 42)
          }, 3500)
        },
        { enableHighAccuracy: true },
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

  // Filter buses based on Destination, Service Type, and Search Query
  const filteredBuses = Object.values(liveBuses).filter((bus) => {
    if (destinationFilter !== 'All') {
      const df = destinationFilter.toLowerCase()
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
        bus.route_number?.toLowerCase().includes(q)
      if (!searchMatch) return false
    }

    return true
  })

  const passengerCoords = [12.8718, 74.8430] // Mangaluru Statebank Central Terminal
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
    <main className="transit-app">
      {/* 1. TOP OFFICIAL MICRO-HEADER */}
      <div className="gov-topbar">
        <div className="gov-topbar-content">
          <span className="gov-title">
            ಕರ್ನಾಟಕ ಸರ್ಕಾರ • Department of Public Land Transport • Coastal Transit Network
          </span>
          <span className="gov-badge">Official Passenger Information System (PIS)</span>
        </div>
      </div>

      {/* 2. OFFICIAL MAIN HEADER */}
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">
            <Bus size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="app-title">Karavali Sarige • Transit</h1>
            <p className="brand-subtitle">Coastal Karnataka Real-Time Bus Radar</p>
          </div>
        </div>

        {/* Database & GPS Live Status Pill */}
        <div className="system-status-badge">
          <span className="status-dot-green" />
          <span>{dbStatus ? 'SQL Database Connected' : 'GPS Satellite Live'}</span>
        </div>

        {/* User-Friendly Mode Switcher */}
        <nav className="role-switch" aria-label="Switch User Mode">
          <button
            type="button"
            onClick={() => setRole('passenger')}
            className={`role-button ${role === 'passenger' ? 'is-selected' : ''}`}
          >
            Passenger Live Radar
          </button>
          <button
            type="button"
            onClick={() => setRole('conductor')}
            className={`role-button ${role === 'conductor' ? 'is-selected' : ''}`}
          >
            Staff / Driver Portal
          </button>
        </nav>
      </header>

      {/* 3. OFFICIAL PASSENGER ADVISORY TICKER */}
      {alerts.length > 0 && role === 'passenger' && (
        <div className="alert-banner" role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <span className="ticker-alert">{alerts[currentAlertIndex]?.message}</span>
        </div>
      )}

      {/* 4. MAIN CONTENT AREA */}
      <section className="app-content">
        {role === 'passenger' ? (
          <div className="passenger-dashboard">
            {/* LEFT SIDEBAR: SIMPLE, INTUITIVE, LIGHT & CLEAN */}
            <aside className="bus-sidebar">
              {/* CURRENT BOARDING STOP */}
              <div className="boarding-card">
                <MapPin size={16} className="pin-icon" />
                <div>
                  <span className="boarding-label">Your Boarding Station</span>
                  <strong className="boarding-stop">Mangaluru Statebank Central Terminal</strong>
                </div>
              </div>

              {/* 1-TAP DESTINATION CHIPS */}
              <div className="quick-filter-group">
                <span className="filter-group-label">Select Destination:</span>
                <div className="destination-chips">
                  {[
                    { id: 'All', label: 'All Routes' },
                    { id: 'Surathkal', label: 'Surathkal / NITK' },
                    { id: 'Udupi', label: 'Udupi' },
                    { id: 'Kuloor', label: 'Kuloor' },
                    { id: 'Statebank', label: 'Statebank' },
                  ].map((dest) => (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => setDestinationFilter(dest.id)}
                      className={`dest-chip ${destinationFilter === dest.id ? 'chip-active' : ''}`}
                    >
                      {dest.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SERVICE TYPE TOGGLE (All / Express / Ordinary) */}
              <div className="service-filter-row">
                <span className="filter-group-label">Service Type</span>
                <div className="service-toggle">
                  <button
                    type="button"
                    onClick={() => setServiceTypeFilter('All')}
                    className={`toggle-btn ${serviceTypeFilter === 'All' ? 'is-active' : ''}`}
                  >
                    All ({Object.keys(liveBuses).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceTypeFilter('Express')}
                    className={`toggle-btn toggle-express ${serviceTypeFilter === 'Express' ? 'is-active' : ''}`}
                  >
                    ⚡ Express
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceTypeFilter('City')}
                    className={`toggle-btn toggle-local ${serviceTypeFilter === 'City' ? 'is-active' : ''}`}
                  >
                    🚌 Ordinary
                  </button>
                </div>
              </div>

              {/* SEARCH INPUT */}
              <div className="search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search route number, bus name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="clear-search-btn"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* LIVE BUSES LIST */}
              <div className="bus-feed">
                <div className="feed-header-row">
                  <h3>Active Coastal Buses ({filteredBuses.length})</h3>
                  {selectedBusId && (
                    <button
                      type="button"
                      onClick={() => setSelectedBusId(null)}
                      className="reset-btn"
                    >
                      Show All Buses
                    </button>
                  )}
                </div>

                {filteredBuses.length === 0 ? (
                  <div className="empty-buses-box">
                    <p>No operating buses match your destination filter.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setDestinationFilter('All')
                        setServiceTypeFilter('All')
                        setSearchQuery('')
                      }}
                      className="reset-filters-btn"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  filteredBuses.map((bus) => {
                    const isSelected = selectedBusId === bus.bus_id
                    const isExpress = (bus.service_type || '').toLowerCase().includes('express')
                    const isDelayed = (bus.delay_minutes || 0) > 0

                    return (
                      <article
                        key={bus.bus_id}
                        onClick={() => setSelectedBusId(bus.bus_id)}
                        className={`bus-card-simple ${isSelected ? 'card-selected' : ''}`}
                      >
                        {/* Top: Route Tag, Name, Service Badge */}
                        <div className="card-top">
                          <div className="card-title-block">
                            <span className="route-tag">Route #{bus.route_number || '15'}</span>
                            <h4 className="bus-name">{bus.bus_name}</h4>
                            {isSelected && (
                              <CheckCircle2 size={16} className="check-icon" />
                            )}
                          </div>
                          <span className={`service-badge ${isExpress ? 'badge-express' : 'badge-local'}`}>
                            {isExpress ? '⚡ Express' : '🚌 Ordinary'}
                          </span>
                        </div>

                        {/* Route Corridor */}
                        <p className="card-route">{bus.route_name}</p>

                        {/* Arrival & Delay Highlights */}
                        <div className="card-highlights">
                          <div className="highlight-item countdown-box">
                            <span className="highlight-label">Next Arrival</span>
                            <strong className="countdown-value">{bus.eta_minutes ?? 3} MINS</strong>
                          </div>

                          <div className="highlight-item">
                            <span className="highlight-label">Scheduled Time</span>
                            <strong className="clock-value">{bus.estimated_arrival || '1:15 PM'}</strong>
                          </div>

                          <div className="highlight-item">
                            <span className="highlight-label">Delay Status</span>
                            <strong className={isDelayed ? 'status-delayed' : 'status-ontime'}>
                              {isDelayed ? `+${bus.delay_minutes}m Delay` : 'On Time'}
                            </strong>
                          </div>
                        </div>

                        {/* Bottom Row: Seating + Night Alert + Action */}
                        <div className="card-bottom">
                          <div className="pills-row">
                            <span className="crowd-pill">
                              {bus.crowd_status || 'Seats Available'}
                            </span>
                            {bus.is_last_bus && (
                              <span className="lastbus-pill">🌙 Night Last Bus</span>
                            )}
                          </div>
                          <span className={`track-prompt ${isSelected ? 'prompt-active' : ''}`}>
                            {isSelected ? '🎯 Currently Tracking' : 'Click to Track →'}
                          </span>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>

              <footer className="sidebar-footer">
                {dbStatus ? '🗄️ SQL Database Connected & Logging • ' : ''}
                📍 Real-Time Public Transport Telemetry
              </footer>
            </aside>

            {/* RIGHT PANEL: LEAFLET MAP WITH CLEAN FLOATING HUD */}
            <div className="map-panel">
              {/* CLEAN OFFICIAL FLOATING TRACKING HUD (ZOMATO STYLE) */}
              {trackedBus ? (
                <div className="floating-hud">
                  <div className="hud-left">
                    <span className="pulsing-green-dot" />
                    <div>
                      <div className="hud-bus-header">
                        <strong className="hud-bus-name">{trackedBus.bus_name}</strong>
                        <span className="route-tag">Route #{trackedBus.route_number}</span>
                        <span className={`service-badge ${trackedBus.service_type?.includes('Express') ? 'badge-express' : 'badge-local'}`}>
                          {trackedBus.service_type}
                        </span>
                      </div>
                      <span className="hud-bus-route">
                        {trackedBus.route_name} • <strong>{distanceToPassenger} km away from your stop</strong>
                      </span>
                    </div>
                  </div>

                  <div className="hud-stats">
                    <div className="hud-stat">
                      <span>Distance to You</span>
                      <strong style={{ color: '#1d4ed8' }}>{distanceToPassenger} km</strong>
                    </div>
                    <div className="hud-stat">
                      <span>Arrival Time</span>
                      <strong>{trackedBus.eta_minutes ?? 3} Mins ({trackedBus.estimated_arrival || '1:15 PM'})</strong>
                    </div>
                    <div className="hud-stat">
                      <span>Live Speed</span>
                      <strong>{trackedBus.speed ?? 38} km/h</strong>
                    </div>
                    <div className="hud-stat">
                      <span>Status</span>
                      <strong className={trackedBus.delay_minutes > 0 ? 'status-delayed' : 'status-ontime'}>
                        {trackedBus.delay_minutes > 0 ? `+${trackedBus.delay_minutes}m Delay` : 'On Time'}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedBusId(null)}
                    className="hud-close-action"
                    title="Show all fleet buses on map"
                  >
                    <X size={15} />
                    <span>Show All Buses</span>
                  </button>
                </div>
              ) : (
                <div className="map-tracking-hint">
                  <span>💡 <strong>Live Tracking Mode:</strong> Select any bus to view its real-time blue route line to your stop!</span>
                </div>
              )}

              <Suspense fallback={<div className="map-loading">Loading coastal transit map…</div>}>
                <TransitMap
                  buses={filteredBuses}
                  selectedBusId={selectedBusId}
                  onSelectBus={(busId) => setSelectedBusId(busId)}
                  mapCenter={mapCenter}
                  passengerCoords={passengerCoords}
                  passengerStopName="Mangaluru Statebank Terminal"
                />
              </Suspense>
            </div>
          </div>
        ) : (
          /* CONDUCTOR / STAFF DUTY PORTAL */
          <div className="conductor-page">
            <div className="conductor-box">
              {!isLoggedIn ? (
                <form onSubmit={handleStartShift} className="driver-form">
                  <div className="form-head">
                    <span className="driver-avatar"><Radio size={24} /></span>
                    <h2>Staff &amp; Driver Duty Login</h2>
                    <p>Official Coastal Bus GPS Streaming &amp; Telemetry Portal</p>
                  </div>

                  {/* 1-Click Quick Bus Profiles */}
                  <div className="quick-presets">
                    <span className="presets-title">Select Scheduled Bus Profile:</span>
                    <div className="preset-buttons">
                      <button
                        type="button"
                        onClick={() => applyPreset('vishal')}
                        className={`preset-btn ${busData.bus_name === 'Vishal Express' ? 'preset-active' : ''}`}
                      >
                        ⚡ Vishal Express (#15)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('canara')}
                        className={`preset-btn ${busData.bus_name.includes('Canara') ? 'preset-active' : ''}`}
                      >
                        ⚡ Canara Pinto (NH-66)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('padmambika')}
                        className={`preset-btn ${busData.bus_name.includes('Padmambika') ? 'preset-active' : ''}`}
                      >
                        🚌 Padmambika (#21)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('coastal_star')}
                        className={`preset-btn ${busData.bus_name.includes('Coastal Star') ? 'preset-active' : ''}`}
                      >
                        🚌 Coastal Star (#15B)
                      </button>
                    </div>
                  </div>

                  {/* Clean Form Grid */}
                  <div className="form-row-2">
                    <div className="input-field">
                      <label htmlFor={phoneInputId}>Driver / Conductor Phone</label>
                      <input
                        id={phoneInputId}
                        type="tel"
                        value={busData.driver_phone}
                        onChange={(e) => setBusData({ ...busData, driver_phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="input-field">
                      <label htmlFor={vehicleInputId}>Vehicle Registration Number</label>
                      <input
                        id={vehicleInputId}
                        type="text"
                        value={busData.vehicle_number}
                        onChange={(e) => setBusData({ ...busData, vehicle_number: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="input-field">
                      <label htmlFor={busNameInputId}>Bus Service Name</label>
                      <input
                        id={busNameInputId}
                        type="text"
                        value={busData.bus_name}
                        onChange={(e) => setBusData({ ...busData, bus_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="input-field">
                      <label htmlFor={serviceSelectId}>Service Category</label>
                      <select
                        id={serviceSelectId}
                        value={busData.service_type}
                        onChange={(e) => setBusData({ ...busData, service_type: e.target.value })}
                      >
                        <option value="Express">⚡ Express Service</option>
                        <option value="City / Ordinary">🚌 City / Ordinary Service</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row-3">
                    <div className="input-field">
                      <label htmlFor={routeNumInputId}>Route #</label>
                      <input
                        id={routeNumInputId}
                        type="text"
                        value={busData.route_number}
                        onChange={(e) => setBusData({ ...busData, route_number: e.target.value })}
                        required
                      />
                    </div>
                    <div className="input-field">
                      <label htmlFor={originInputId}>Starting From</label>
                      <input
                        id={originInputId}
                        type="text"
                        value={busData.origin}
                        onChange={(e) => setBusData({ ...busData, origin: e.target.value })}
                        required
                      />
                    </div>
                    <div className="input-field">
                      <label htmlFor={destInputId}>Destination</label>
                      <input
                        id={destInputId}
                        type="text"
                        value={busData.destination}
                        onChange={(e) => setBusData({ ...busData, destination: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="input-field">
                      <label htmlFor={crowdSelectId}>Current Seating Availability</label>
                      <select
                        id={crowdSelectId}
                        value={busData.crowd_status}
                        onChange={(e) => setBusData({ ...busData, crowd_status: e.target.value })}
                      >
                        <option value="Seats Available">🟢 Seats Available</option>
                        <option value="Standing Allowed">🟡 Standing Allowed</option>
                        <option value="Overcrowded">🔴 Full Capacity</option>
                      </select>
                    </div>

                    <label htmlFor={lastBusCheckId} className="checkbox-item">
                      <input
                        type="checkbox"
                        id={lastBusCheckId}
                        checked={busData.is_last_bus}
                        onChange={(e) => setBusData({ ...busData, is_last_bus: e.target.checked })}
                      />
                      <span>Mark as Night Last Bus</span>
                    </label>
                  </div>

                  {gpsError && <p className="gps-warning-text">{gpsError}</p>}

                  <button type="submit" className="start-shift-btn">
                    Start Duty &amp; Stream Live GPS
                  </button>
                </form>
              ) : (
                /* ACTIVE DUTY VIEW */
                <div className="active-shift-card">
                  <div className="active-header">
                    <span className="live-pulse-icon"><Navigation size={28} /></span>
                    <h2>Duty Active &amp; Streaming</h2>
                    <p className="subtext">GPS telemetry is live on the public Karavali Sarige radar</p>
                  </div>

                  <div className="shift-summary-grid">
                    <div className="summary-card">
                      <span className="label">Bus &amp; Route</span>
                      <strong>{busData.bus_name} (Route #{busData.route_number})</strong>
                    </div>
                    <div className="summary-card">
                      <span className="label">Corridor</span>
                      <strong>{busData.origin} ➔ {busData.destination}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="label">Staff Contact</span>
                      <strong>{busData.driver_phone}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="label">Vehicle Registration</span>
                      <strong>{busData.vehicle_number}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="label">Service Category</span>
                      <strong>{busData.service_type}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="label">SQL Database</span>
                      <strong className="status-ontime">💾 Logged in transit.db</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleEndShift}
                    className="end-shift-btn"
                  >
                    End Duty &amp; Stop Streaming
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
