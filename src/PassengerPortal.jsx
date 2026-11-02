import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Menu,
  Bell,
  Bus,
  ArrowUpDown,
  ChevronDown,
  Search,
  ArrowLeft,
  Clock,
  MapPin,
  Flag,
  RotateCw,
  X,
  Radio,
  Building,
  HelpCircle,
  MessageSquare,
  Phone,
  Languages,
  Compass,
  Crosshair,
  CheckCircle2,
  Navigation,
} from 'lucide-react'
import io from 'socket.io-client'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { apiUrl, socketUrl } from './api.js'
import { translations } from './translations.js'

// Custom Leaflet Icons for Passenger Map (Screen 4)
const busLiveIcon = L.divIcon({
  className: 'custom-bus-live-marker',
  html: `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;">
      <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(37,99,235,0.25);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:relative;width:34px;height:34px;border-radius:50%;background:#2563eb;color:#fff;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(37,99,235,0.5);display:flex;align-items:center;justify-content:center;font-size:16px;">
        🚍
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -22],
})

const stopPinIcon = (name, isDestination = false) =>
  L.divIcon({
    className: 'custom-stop-pin',
    html: `
    <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
      <div style="background:#ffffff;border:1.5px solid ${
        isDestination ? '#e11d48' : '#2563eb'
      };padding:2px 7px;border-radius:12px;font-size:11px;font-weight:800;color:${
      isDestination ? '#e11d48' : '#1e293b'
    };box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;">
        ${isDestination ? '🚩 ' : ''}${name}
      </div>
      <div style="width:10px;height:10px;border-radius:50%;background:${
        isDestination ? '#e11d48' : '#2563eb'
      };border:2px solid #ffffff;box-shadow:0 2px 4px rgba(0,0,0,0.3);margin-top:2px;"></div>
    </div>
  `,
    iconSize: [80, 36],
    iconAnchor: [40, 32],
    popupAnchor: [0, -32],
  })

// Map Controller for Centering and Bounds
function MapViewportController({ bounds, center }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true })
      } catch (err) {
        console.debug('Map fitBounds:', err)
      }
    } else if (center && center[0] && center[1]) {
      map.setView(center, 13, { animate: true })
    }
  }, [bounds, center, map])
  return null
}

export default function PassengerPortal({
  lang = 'en',
  toggleLanguage,
  onSelectRole,
}) {
  const t = translations[lang] || translations.en

  // 4-Screen Workflow Progression:
  // 1: Homepage (Current Bus Stop & Destination Search)
  // 2: Available Buses & Timings
  // 3: Bus Details & Route Timeline
  // 4: Live Tracking Map
  const [screen, setScreen] = useState(1)

  // Drawer & Modal Overlays
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [findStopOpen, setFindStopOpen] = useState(false)
  const [findStopTab, setFindStopTab] = useState('name') // 'name' | 'landmark' | 'nearme'
  const [activeModal, setActiveModal] = useState(null) // 'helpdesk' | 'feedback' | 'contact'

  // Search Fields
  const [currentStop, setCurrentStop] = useState('Surathkal')
  const [destination, setDestination] = useState('Udupi')
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false)
  const [toDropdownOpen, setToDropdownOpen] = useState(false)
  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')

  // Bus List & Filters (Screen 2)
  const [buses, setBuses] = useState([])
  const [loadingBuses, setLoadingBuses] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'live' | 'scheduled'

  // Selected Bus Details (Screen 3 & Screen 4)
  const [selectedBus, setSelectedBus] = useState(null)
  const [routeDetails, setRouteDetails] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  // Real-time Telemetry & Seconds Elapsed Timer (Screen 4)
  const [secondsAgo, setSecondsAgo] = useState(15)
  const [liveTelemetry, setLiveTelemetry] = useState({})
  const socketRef = useRef(null)

  // Verified Bus Stops Cache (for Dropdowns & Find Stop modal)
  const [allStops, setAllStops] = useState([])
  const [stopSearchQuery, setStopSearchQuery] = useState('')
  const [nearMeStops, setNearMeStops] = useState([])
  const [nearMeLoading, setNearMeLoading] = useState(false)
  const [nearMeError, setNearMeError] = useState('')

  // Passenger Feedback Form
  const [feedbackName, setFeedbackName] = useState('')
  const [feedbackEmail, setFeedbackEmail] = useState('')
  const [feedbackCategory] = useState('Service Quality')
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

  // Notifications List
  const transitNotifications = [
    {
      id: 1,
      title: 'NH-66 Coastal Corridor GPS Active',
      time: 'Just now',
      desc: 'Real-time telemetry broadcasting smoothly between Mangaluru, Surathkal, Mulki and Udupi.',
      badge: 'Operational',
      badgeColor: 'bg-green-100 text-green-700',
    },
    {
      id: 2,
      title: 'Night Transit Operating',
      time: '15 min ago',
      desc: 'Padmambika Local (Route 21) operating as scheduled night service to Kuloor.',
      badge: 'Night Bus',
      badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
      id: 3,
      title: 'Punctuality Advisory',
      time: '1 hour ago',
      desc: 'Express buses on Surathkal–Udupi corridor running on planned 1h 35m schedules.',
      badge: 'Advisory',
      badgeColor: 'bg-amber-100 text-amber-700',
    },
  ]

  // Popular Routes Shortcuts
  const POPULAR_ROUTES = [
    { from: 'Mangaluru', to: 'Udupi' },
    { from: 'Surathkal', to: 'Udupi' },
    { from: 'Mangaluru', to: 'Kundapura' },
    { from: 'Mulki', to: 'Udupi' },
  ]

  // Setup WebSocket Telemetry Connection
  useEffect(() => {
    const socket = io(socketUrl)
    socketRef.current = socket

    socket.on('sync_buses', (synced) => {
      if (synced && typeof synced === 'object') {
        setLiveTelemetry((prev) => ({ ...prev, ...synced }))
      }
    })

    socket.on('live_location_broadcast', (data) => {
      if (!data || !data.bus_id) return
      setLiveTelemetry((prev) => ({
        ...prev,
        [data.bus_id]: {
          ...(prev[data.bus_id] || {}),
          ...data,
          timestamp: data.timestamp || Date.now(),
        },
      }))
      setSecondsAgo(1)
    })

    socket.on('bus_location_update', (data) => {
      if (!data || !data.bus_id) return
      setLiveTelemetry((prev) => ({
        ...prev,
        [data.bus_id]: {
          ...(prev[data.bus_id] || {}),
          ...data,
          timestamp: data.timestamp || Date.now(),
        },
      }))
      setSecondsAgo(1)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // Seconds Ago Ticker on Screen 4
  useEffect(() => {
    if (screen !== 4) return undefined
    const timer = setInterval(() => {
      setSecondsAgo((s) => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [screen])

  // Fetch verified bus stops on mount
  useEffect(() => {
    fetch(`${apiUrl}/api/public/stops`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.stops)) {
          setAllStops(data.stops)
        }
      })
      .catch((err) => console.debug('Failed to load stops:', err))
  }, [])

  // Stop Search Autocomplete Dropdowns
  const fromSuggestions = useMemo(() => {
    const q = fromQuery.trim().toLowerCase()
    if (!q) return allStops.slice(0, 8)
    return allStops.filter(
      (s) =>
        s.stop_name.toLowerCase().includes(q) ||
        (s.stop_name_kn && s.stop_name_kn.includes(q)) ||
        (s.alternative_names && s.alternative_names.toLowerCase().includes(q))
    )
  }, [allStops, fromQuery])

  const toSuggestions = useMemo(() => {
    const q = toQuery.trim().toLowerCase()
    if (!q) return allStops.slice(0, 8)
    return allStops.filter(
      (s) =>
        s.stop_name.toLowerCase().includes(q) ||
        (s.stop_name_kn && s.stop_name_kn.includes(q)) ||
        (s.alternative_names && s.alternative_names.toLowerCase().includes(q))
    )
  }, [allStops, toQuery])

  // Search Stops in Find Stop Modal
  const searchedStops = useMemo(() => {
    if (!stopSearchQuery.trim()) return allStops
    const q = stopSearchQuery.trim().toLowerCase()
    return allStops.filter(
      (s) =>
        s.stop_name.toLowerCase().includes(q) ||
        (s.stop_name_kn && s.stop_name_kn.includes(q)) ||
        (s.alternative_names && s.alternative_names.toLowerCase().includes(q)) ||
        (s.nearby_landmarks && s.nearby_landmarks.toLowerCase().includes(q))
    )
  }, [allStops, stopSearchQuery])

  // Execute Search for Buses
  const handleSearchBuses = async (overrideFrom, overrideTo) => {
    const from = (overrideFrom || currentStop || 'Surathkal').trim()
    const to = (overrideTo || destination || 'Udupi').trim()
    setCurrentStop(from)
    setDestination(to)
    setFromDropdownOpen(false)
    setToDropdownOpen(false)
    setLoadingBuses(true)

    try {
      const res = await fetch(
        `${apiUrl}/api/public/buses/search?from=${encodeURIComponent(
          from
        )}&to=${encodeURIComponent(to)}`
      )
      const data = await res.json()
      if (data.success && Array.isArray(data.buses)) {
        setBuses(data.buses)
      } else {
        setBuses([])
      }
      setScreen(2)
    } catch (err) {
      console.error('Search error:', err)
      setBuses([])
      setScreen(2)
    } finally {
      setLoadingBuses(false)
    }
  }

  // Swap From & To
  const handleSwapStops = () => {
    const prevFrom = currentStop
    const prevTo = destination
    setCurrentStop(prevTo)
    setDestination(prevFrom)
  }

  // Select a Bus and load its full route timeline (Screen 3)
  const handleSelectBusDetails = async (bus) => {
    setSelectedBus(bus)
    setLoadingRoute(true)
    setScreen(3)

    try {
      const res = await fetch(`${apiUrl}/api/public/buses/${bus.bus_id}/route`)
      const data = await res.json()
      if (data.success && data.bus) {
        setRouteDetails(data.bus)
      } else {
        setRouteDetails(bus)
      }
    } catch (err) {
      console.error('Failed to load bus route:', err)
      setRouteDetails(bus)
    } finally {
      setLoadingRoute(false)
    }
  }

  // Directly track a live bus (Screen 4)
  const handleTrackBusDirectly = async (bus) => {
    setSelectedBus(bus)
    setSecondsAgo(15)
    setScreen(4)

    try {
      const res = await fetch(`${apiUrl}/api/public/buses/${bus.bus_id}/route`)
      const data = await res.json()
      if (data.success && data.bus) {
        setRouteDetails(data.bus)
      } else {
        setRouteDetails(bus)
      }
    } catch {
      setRouteDetails(bus)
    }
  }

  // Geolocation for "Find Stops Near Me"
  const handleFindStopsNearMe = () => {
    if (!navigator.geolocation) {
      setNearMeError('Geolocation is not supported by your browser.')
      return
    }
    setNearMeLoading(true)
    setNearMeError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `${apiUrl}/api/public/stops/nearby?lat=${latitude}&lng=${longitude}&radius=20`
          )
          const data = await res.json()
          if (data.success && Array.isArray(data.stops)) {
            setNearMeStops(data.stops)
          } else {
            setNearMeStops([])
          }
        } catch {
          setNearMeError('Failed to fetch nearby bus stops.')
        } finally {
          setNearMeLoading(false)
        }
      },
      (err) => {
        setNearMeLoading(false)
        setNearMeError(t.locationPermissionDenied || 'Location permission was denied.')
        console.warn('Geolocation denied:', err)
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  // Submit Feedback
  const handleSubmitFeedback = async (e) => {
    e.preventDefault()
    if (!feedbackMessage.trim()) return
    setFeedbackSubmitting(true)
    try {
      const res = await fetch(`${apiUrl}/api/public/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: feedbackName.trim() || 'Passenger',
          email: feedbackEmail.trim(),
          category: feedbackCategory,
          rating: feedbackRating,
          message: feedbackMessage.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setFeedbackSuccess(true)
        setFeedbackMessage('')
      }
    } catch (err) {
      console.error('Feedback submit failed:', err)
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  // Filtered Bus Counts for Screen 2
  const liveCount = useMemo(
    () => buses.filter((b) => b.is_live || b.tracking_status === 'LIVE').length,
    [buses]
  )
  const scheduledCount = useMemo(
    () => buses.filter((b) => b.tracking_status === 'SCHEDULED' || !b.is_live).length,
    [buses]
  )
  const displayedBuses = useMemo(() => {
    if (activeFilter === 'live') {
      return buses.filter((b) => b.is_live || b.tracking_status === 'LIVE')
    }
    if (activeFilter === 'scheduled') {
      return buses.filter((b) => b.tracking_status === 'SCHEDULED' || !b.is_live)
    }
    return buses
  }, [buses, activeFilter])

  // Get selected bus live position & coordinates
  const trackedTelemetry = useMemo(() => {
    if (!selectedBus) return null
    return liveTelemetry[selectedBus.bus_id] || selectedBus
  }, [selectedBus, liveTelemetry])

  const busCoords = useMemo(() => {
    if (trackedTelemetry && trackedTelemetry.latitude && trackedTelemetry.longitude) {
      return [trackedTelemetry.latitude, trackedTelemetry.longitude]
    }
    // Default coastal position between Surathkal and Mulki
    return [13.0908, 74.7903]
  }, [trackedTelemetry])

  // Route Polyline stops and coordinates for Screen 4
  const routeStopsList = useMemo(() => {
    if (routeDetails && Array.isArray(routeDetails.stops) && routeDetails.stops.length > 0) {
      return routeDetails.stops
    }
    if (selectedBus && Array.isArray(selectedBus.stops) && selectedBus.stops.length > 0) {
      return selectedBus.stops
    }
    // Fallback corridor sequence matching reference image
    return [
      { stop_name: 'Surathkal', planned_arrival: '10:40 AM', latitude: 13.0068, longitude: 74.7954 },
      { stop_name: 'Mulki', planned_arrival: '11:05 AM', latitude: 13.0908, longitude: 74.7903 },
      { stop_name: 'Kaup', planned_arrival: '11:25 AM', latitude: 13.2208, longitude: 74.7431 },
      { stop_name: 'Kundapura', planned_arrival: '11:50 AM', latitude: 13.6279, longitude: 74.6931 },
      { stop_name: 'Udupi', planned_arrival: '12:15 PM', latitude: 13.3409, longitude: 74.7421 },
    ]
  }, [routeDetails, selectedBus])

  const polylineCoordinates = useMemo(() => {
    return routeStopsList
      .map((s) => {
        if (s.latitude && s.longitude) return [s.latitude, s.longitude]
        const match = allStops.find(
          (as) => as.stop_name.toLowerCase() === s.stop_name.toLowerCase()
        )
        if (match) return [match.latitude, match.longitude]
        return null
      })
      .filter(Boolean)
  }, [routeStopsList, allStops])

  const mapBounds = useMemo(() => {
    if (polylineCoordinates.length >= 2) {
      return polylineCoordinates
    }
    return [
      [13.0068, 74.7954],
      [13.3409, 74.7421],
    ]
  }, [polylineCoordinates])

  return (
    <div className="w-full min-h-screen bg-slate-100 flex justify-center py-0 sm:py-6 text-slate-900 select-none">
      {/* Mobile Mockup Frame (Pixel-accurate matching 4 reference phones) */}
      <div className="w-full max-w-[440px] min-h-screen sm:min-h-[880px] bg-white sm:rounded-[36px] sm:shadow-2xl sm:border-[8px] sm:border-slate-800 overflow-hidden flex flex-col relative">

        {/* ============================================================== */}
        {/* SCREEN 1: HOMEPAGE (Reference Image Screen 1)                   */}
        {/* ============================================================== */}
        {screen === 1 && (
          <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto">
            {/* Header */}
            <header className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-20 shadow-xs">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                aria-label="Open Navigation Menu"
              >
                <Menu size={24} strokeWidth={2.4} />
              </button>

              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Bus size={18} strokeWidth={2.4} />
                </span>
                <span className="font-extrabold text-base tracking-tight text-slate-900">
                  Karavali-Transit
                </span>
              </div>

              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 relative active:scale-95 transition-all"
                aria-label="Notifications"
              >
                <Bell size={21} strokeWidth={2.2} />
                <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-2 right-2 border-2 border-white" />
              </button>
            </header>

            <div className="p-5 flex-1 flex flex-col space-y-5">
              {/* Welcome Greetings */}
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Hello Passenger</span>
                  <span className="text-2xl">👋</span>
                </h1>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Find your bus and track it live
                </p>
              </div>

              {/* Journey Search Card */}
              <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-100 space-y-3 relative">
                {/* Current Bus Stop (Boarding) */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <MapPin size={13} className="text-emerald-500 shrink-0" />
                      <span>Current Bus Stop</span>
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      setFromDropdownOpen(true)
                      setToDropdownOpen(false)
                    }}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-500 cursor-pointer transition-all"
                  >
                    <span className="text-sm font-bold text-slate-800">
                      {currentStop || 'Select Boarding Stop'}
                    </span>
                    <ChevronDown size={17} className="text-slate-400" />
                  </div>

                  {fromDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 max-h-56 overflow-y-auto">
                      <div className="px-3 py-1.5 border-b border-slate-100">
                        <input
                          type="text"
                          placeholder="Search stop name..."
                          value={fromQuery}
                          onChange={(e) => setFromQuery(e.target.value)}
                          className="w-full text-xs font-semibold bg-slate-100 rounded-lg px-2.5 py-1.5 outline-hidden"
                          autoFocus
                        />
                      </div>
                      {fromSuggestions.map((s) => (
                        <button
                          key={s.stop_id}
                          type="button"
                          onClick={() => {
                            setCurrentStop(s.stop_name)
                            setFromDropdownOpen(false)
                            setFromQuery('')
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-blue-50 text-xs font-bold text-slate-700 flex items-center justify-between"
                        >
                          <span>{s.stop_name}</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {s.stop_name_kn}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Vertical Swap Button */}
                <div className="flex justify-end -my-1 pr-2">
                  <button
                    type="button"
                    onClick={handleSwapStops}
                    className="w-8 h-8 rounded-full border border-slate-200 bg-white shadow-xs flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-400 active:scale-95 transition-all"
                    title="Swap From and To"
                  >
                    <ArrowUpDown size={15} strokeWidth={2.4} />
                  </button>
                </div>

                {/* Destination */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <MapPin size={13} className="text-rose-500 shrink-0" />
                      <span>Destination</span>
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      setToDropdownOpen(true)
                      setFromDropdownOpen(false)
                    }}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-500 cursor-pointer transition-all"
                  >
                    <span className="text-sm font-bold text-slate-800">
                      {destination || 'Select Destination'}
                    </span>
                    <ChevronDown size={17} className="text-slate-400" />
                  </div>

                  {toDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 max-h-56 overflow-y-auto">
                      <div className="px-3 py-1.5 border-b border-slate-100">
                        <input
                          type="text"
                          placeholder="Search destination..."
                          value={toQuery}
                          onChange={(e) => setToQuery(e.target.value)}
                          className="w-full text-xs font-semibold bg-slate-100 rounded-lg px-2.5 py-1.5 outline-hidden"
                          autoFocus
                        />
                      </div>
                      {toSuggestions.map((s) => (
                        <button
                          key={s.stop_id}
                          type="button"
                          onClick={() => {
                            setDestination(s.stop_name)
                            setToDropdownOpen(false)
                            setToQuery('')
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-blue-50 text-xs font-bold text-slate-700 flex items-center justify-between"
                        >
                          <span>{s.stop_name}</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {s.stop_name_kn}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search Buses Large Blue Button */}
                <button
                  type="button"
                  onClick={() => handleSearchBuses()}
                  disabled={loadingBuses}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer"
                >
                  <Search size={18} strokeWidth={2.5} />
                  <span>{loadingBuses ? 'Searching...' : 'Search Buses'}</span>
                </button>
              </div>

              {/* Popular Routes */}
              <div>
                <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5">
                  Popular Routes
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {POPULAR_ROUTES.map((route) => (
                    <button
                      key={`${route.from}-${route.to}`}
                      type="button"
                      onClick={() => handleSearchBuses(route.from, route.to)}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-blue-500 hover:text-blue-600 active:bg-blue-50 text-center shadow-2xs transition-all"
                    >
                      {route.from} → {route.to}
                    </button>
                  ))}
                </div>
              </div>

              {/* Find My Bus Stop Card */}
              <div
                onClick={() => setFindStopOpen(true)}
                className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex items-center gap-3.5 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <MapPin size={20} strokeWidth={2.4} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 leading-tight">
                    Don't know your bus stop?
                  </h3>
                  <span className="text-xs font-extrabold text-blue-600 hover:underline">
                    Find a Stop →
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Coastal Artwork (Reference Image Screen 1) */}
            <div className="mt-auto pointer-events-none relative w-full h-28 overflow-hidden opacity-90">
              <div className="absolute inset-0 bg-gradient-to-t from-sky-100/80 via-sky-50/40 to-transparent" />
              <svg
                viewBox="0 0 500 150"
                preserveAspectRatio="none"
                className="absolute bottom-0 w-full h-20 text-sky-200/50 fill-current"
              >
                <path d="M0.00,49.98 C149.99,150.00 349.89,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
              </svg>
              <svg
                viewBox="0 0 500 150"
                preserveAspectRatio="none"
                className="absolute bottom-0 w-full h-14 text-blue-300/40 fill-current"
              >
                <path d="M0.00,49.98 C180.00,120.00 320.00,10.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
              </svg>
              <div className="absolute bottom-2 left-4 text-[10px] font-bold text-sky-800 tracking-wider">
                🌊 NH-66 Coastal Karnataka Corridor
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SCREEN 2: AVAILABLE BUSES (Reference Image Screen 2)            */}
        {/* ============================================================== */}
        {screen === 2 && (
          <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto">
            {/* Top Bar */}
            <header className="px-4 py-3.5 bg-white border-b border-slate-100 flex items-center gap-3 sticky top-0 z-20 shadow-xs">
              <button
                type="button"
                onClick={() => setScreen(1)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                aria-label="Back to Search"
              >
                <ArrowLeft size={22} strokeWidth={2.4} />
              </button>
              <h1 className="text-base font-extrabold text-slate-900 truncate">
                Buses: {currentStop} → {destination}
              </h1>
            </header>

            {/* Filter Pills */}
            <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                All Buses ({buses.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('live')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  activeFilter === 'live'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live ({liveCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('scheduled')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  activeFilter === 'scheduled'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Clock size={12} className={activeFilter === 'scheduled' ? 'text-white' : 'text-slate-500'} />
                <span>Scheduled ({scheduledCount})</span>
              </button>
            </div>

            {/* Bus Cards List */}
            <div className="p-4 space-y-3 flex-1">
              {displayedBuses.length === 0 ? (
                <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200">
                  <Bus size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-800">No buses matching filter</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Try selecting All Buses or changing your boarding and destination stops.
                  </p>
                </div>
              ) : (
                displayedBuses.map((bus) => {
                  const isLive = Boolean(bus.is_live || bus.tracking_status === 'LIVE')
                  return (
                    <div
                      key={bus.bus_id}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-blue-300 transition-all space-y-3 cursor-pointer"
                      onClick={() => handleSelectBusDetails(bus)}
                    >
                      {/* Top Row: Icon, Name, Reg, Badge */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                            <Bus size={20} strokeWidth={2.2} />
                          </div>
                          <div>
                            <h2 className="text-sm font-extrabold text-slate-900 leading-tight">
                              {bus.bus_name}
                            </h2>
                            <p className="text-xs font-semibold text-slate-500">
                              {bus.vehicle_number} • {bus.service_type || 'Non AC'}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                            Scheduled
                          </span>
                        )}
                      </div>

                      {/* Timings Row */}
                      <div className="flex items-center justify-between px-1 py-1">
                        <div>
                          <div className="text-sm font-black text-slate-900 flex items-center gap-1">
                            <Clock size={13} className="text-slate-400" />
                            <span>{bus.boarding_planned_time || '10:40 AM'}</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-500">
                            {bus.boarding_stop || currentStop}
                          </span>
                        </div>

                        <div className="text-slate-400 font-bold text-sm tracking-widest">
                          ⤏
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900 flex items-center justify-end gap-1">
                            <Clock size={13} className="text-slate-400" />
                            <span>{bus.destination_planned_time || '12:15 PM'}</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-500">
                            {bus.destination_stop || destination}
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      {isLive ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTrackBusDirectly(bus)
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold py-2.5 rounded-xl shadow-xs text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <MapPin size={15} strokeWidth={2.4} />
                          <span>Track Bus</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectBusDetails(bus)
                          }}
                          className="w-full bg-white border border-blue-600 hover:bg-blue-50 active:scale-98 text-blue-600 font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SCREEN 3: BUS DETAILS (Reference Image Screen 3)                */}
        {/* ============================================================== */}
        {screen === 3 && selectedBus && (
          <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto">
            {/* Top Bar */}
            <header className="px-4 py-3.5 bg-white border-b border-slate-100 flex items-center gap-3 sticky top-0 z-20 shadow-xs">
              <button
                type="button"
                onClick={() => setScreen(2)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                aria-label="Back to Bus List"
              >
                <ArrowLeft size={22} strokeWidth={2.4} />
              </button>
              <h1 className="text-base font-extrabold text-slate-900">Bus Details</h1>
            </header>

            <div className="p-4 space-y-4 flex-1">
              {/* Bus Summary Card */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-blue-700 shrink-0">
                      <Bus size={22} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                        {selectedBus.bus_name}
                      </h2>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        {selectedBus.vehicle_number} • {selectedBus.service_type || 'Non AC'}
                      </p>
                    </div>
                  </div>

                  {(selectedBus.is_live || selectedBus.tracking_status === 'LIVE') ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                      Scheduled
                    </span>
                  )}
                </div>

                {/* Timetable Boxes Side-by-Side (Matching Screen 3) */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {/* Departure Box */}
                  <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-3 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-sky-100 text-blue-600 flex items-center justify-center shrink-0">
                      <Clock size={15} strokeWidth={2.4} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Departure
                      </span>
                      <span className="text-sm font-black text-slate-900 block leading-tight">
                        {selectedBus.boarding_planned_time || '10:40 AM'}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        ({selectedBus.boarding_stop || currentStop})
                      </span>
                    </div>
                  </div>

                  {/* Arrival (Planned) Box */}
                  <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <Flag size={14} strokeWidth={2.4} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Arrival (Planned)
                      </span>
                      <span className="text-sm font-black text-slate-900 block leading-tight">
                        {selectedBus.destination_planned_time || '12:15 PM'}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        ({selectedBus.destination_stop || destination})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Route & Stops Stepper Timeline */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-4">
                  Route &amp; Stops
                </h3>

                {loadingRoute ? (
                  <div className="text-center py-6 text-xs font-semibold text-slate-400">
                    Loading verified stops...
                  </div>
                ) : (
                  <div className="space-y-0 relative pl-2">
                    {routeStopsList.map((stop, idx) => {
                      const isFirst = idx === 0
                      const isLast = idx === routeStopsList.length - 1

                      return (
                        <div key={stop.stop_order || idx} className="flex items-start gap-3 relative pb-6 last:pb-0">
                          {/* Continuous Vertical Line */}
                          {!isLast && (
                            <div className="absolute left-[7px] top-[18px] bottom-0 w-0.5 bg-slate-200" />
                          )}

                          {/* Pin / Dot */}
                          {isFirst ? (
                            <div className="w-4 h-4 rounded-full border-[3px] border-emerald-500 bg-white shrink-0 mt-0.5 z-10" />
                          ) : isLast ? (
                            <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 mt-0.5 z-10 shadow-xs">
                              <MapPin size={10} strokeWidth={3} />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-slate-300 bg-white shrink-0 mt-0.5 z-10" />
                          )}

                          {/* Stop Info */}
                          <div className="flex-1 -mt-0.5">
                            <div className="text-xs font-black text-slate-900">
                              {stop.stop_name}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                              {stop.planned_arrival || '11:00 AM'}{' '}
                              {isFirst ? (
                                <span className="text-emerald-600 font-bold">(Started)</span>
                              ) : (
                                <span className="text-slate-400 font-medium">(Planned)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Sticky Action Button */}
            <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0">
              <button
                type="button"
                onClick={() => handleTrackBusDirectly(selectedBus)}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MapPin size={17} strokeWidth={2.4} />
                <span>Track This Bus</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SCREEN 4: LIVE TRACKING (Reference Image Screen 4)              */}
        {/* ============================================================== */}
        {screen === 4 && selectedBus && (
          <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
            {/* Top Bar */}
            <header className="px-4 py-3.5 bg-white border-b border-slate-100 flex items-center gap-3 sticky top-0 z-20 shadow-xs">
              <button
                type="button"
                onClick={() => setScreen(3)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                aria-label="Back to Details"
              >
                <ArrowLeft size={22} strokeWidth={2.4} />
              </button>
              <h1 className="text-base font-extrabold text-slate-900">Live Tracking</h1>
            </header>

            {/* Interactive Leaflet Map */}
            <div className="flex-1 relative w-full h-full">
              <MapContainer
                center={busCoords}
                zoom={12}
                zoomControl={false}
                className="w-full h-full z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Blue Route Polyline along coastal corridor */}
                {polylineCoordinates.length >= 2 && (
                  <Polyline
                    positions={polylineCoordinates}
                    color="#2563eb"
                    weight={6}
                    opacity={0.85}
                  />
                )}

                {/* Stop Markers along the Route */}
                {routeStopsList.map((stop, i) => {
                  const isDestination = i === routeStopsList.length - 1
                  if (!stop.latitude || !stop.longitude) return null
                  return (
                    <Marker
                      key={`stop-${stop.stop_name}-${i}`}
                      position={[stop.latitude, stop.longitude]}
                      icon={stopPinIcon(stop.stop_name, isDestination)}
                    >
                      <Popup>
                        <div className="text-xs">
                          <strong>{stop.stop_name}</strong>
                          <br />
                          Planned: {stop.planned_arrival}
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}

                {/* Live Bus Marker */}
                <Marker position={busCoords} icon={busLiveIcon}>
                  <Popup>
                    <div className="text-xs">
                      <strong>{selectedBus.bus_name}</strong>
                      <br />
                      Status: Live Telemetry Active
                    </div>
                  </Popup>
                </Marker>

                <MapViewportController bounds={mapBounds} center={busCoords} />
              </MapContainer>

              {/* Floating Bottom HUD Card (Screen 4) */}
              <div className="absolute bottom-4 left-4 right-4 z-10">
                <div className="bg-white rounded-2xl p-4 shadow-xl border border-slate-100 space-y-3">
                  {/* Bus Name, Reg, Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                        <Bus size={20} strokeWidth={2.2} />
                      </div>
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900 leading-tight">
                          {selectedBus.bus_name}
                        </h2>
                        <p className="text-xs font-semibold text-slate-500">
                          {selectedBus.vehicle_number}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>

                  {/* Next Stop & ETA Boxes */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin size={11} className="text-rose-500 shrink-0" />
                        <span>Next Stop</span>
                      </div>
                      <div className="text-sm font-black text-slate-900 mt-0.5">
                        {trackedTelemetry?.next_stop || 'Mulki'}
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Clock size={11} className="text-blue-500 shrink-0" />
                        <span>ETA</span>
                      </div>
                      <div className="text-sm font-black text-slate-900 mt-0.5">
                        ~ {trackedTelemetry?.eta_minutes || 25} min
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Freshness Bar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <RotateCw size={12} className="text-blue-600 animate-spin" />
                      <span>
                        Last Updated: 10:41 AM • {secondsAgo} sec ago
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* HAMBURGER SLIDE-OUT MENU DRAWER (Top-Left ☰)                    */}
        {/* ============================================================== */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMenuOpen(false)}
            />

            {/* Menu Drawer */}
            <div className="relative w-72 max-w-[80%] bg-white h-full shadow-2xl flex flex-col z-10">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-blue-600 text-white">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Bus size={18} />
                  </span>
                  <div>
                    <h2 className="font-extrabold text-sm leading-tight">Karavali-Transit</h2>
                    <p className="text-[10px] text-blue-100 font-semibold">Passenger Information System</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/20"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setScreen(1)
                    setMenuOpen(false)
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-all"
                >
                  <Navigation size={17} className="text-blue-600" />
                  <span>Home</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    handleSearchBuses('Surathkal', 'Udupi')
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-all"
                >
                  <Bus size={17} className="text-blue-600" />
                  <span>Passenger Radar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setFindStopOpen(true)
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-all"
                >
                  <Compass size={17} className="text-blue-600" />
                  <span>Find Bus Stop</span>
                </button>

                <div className="my-2 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onSelectRole('owner')
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-3 transition-all"
                >
                  <Building size={17} className="text-slate-500" />
                  <span>Fleet Owner Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onSelectRole('conductor')
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-3 transition-all"
                >
                  <Radio size={17} className="text-slate-500" />
                  <span>Conductor Login</span>
                </button>

                <div className="my-2 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setActiveModal('helpdesk')
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-3 transition-all"
                >
                  <HelpCircle size={17} className="text-slate-500" />
                  <span>Helpdesk</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setActiveModal('feedback')
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-3 transition-all"
                >
                  <MessageSquare size={17} className="text-slate-500" />
                  <span>Feedback</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setActiveModal('contact')
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-3 transition-all"
                >
                  <Phone size={17} className="text-slate-500" />
                  <span>Contact Us</span>
                </button>

                <div className="my-2 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    toggleLanguage()
                    setMenuOpen(false)
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-all"
                >
                  <Languages size={17} className="text-blue-600" />
                  <span>{lang === 'en' ? 'ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಿ (Kannada)' : 'Switch to English'}</span>
                </button>
              </nav>

              <div className="p-4 border-t border-slate-100 text-[10px] text-slate-400 font-semibold text-center">
                Karavali-Transit • Coastal Transit System
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* NOTIFICATIONS DRAWER (Top-Right 🔔)                             */}
        {/* ============================================================== */}
        {notificationsOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={() => setNotificationsOpen(false)}
            />
            <div className="relative w-80 max-w-[85%] bg-white h-full shadow-2xl flex flex-col z-10">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Transit Advisories</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                {transitNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/80 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${notif.badgeColor}`}>
                        {notif.badge}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">{notif.time}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">{notif.title}</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{notif.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* FIND BUS STOP MODAL ("Don't know your bus stop? Find a Stop")  */}
        {/* ============================================================== */}
        {findStopOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setFindStopOpen(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass size={20} className="text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Find My Bus Stop</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFindStopOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 px-4 pt-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFindStopTab('name')}
                  className={`pb-2 text-xs font-bold border-b-2 transition-all ${
                    findStopTab === 'name'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Official Stop Name
                </button>
                <button
                  type="button"
                  onClick={() => setFindStopTab('landmark')}
                  className={`pb-2 text-xs font-bold border-b-2 transition-all ${
                    findStopTab === 'landmark'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Nearby Landmark
                </button>
                <button
                  type="button"
                  onClick={() => setFindStopTab('nearme')}
                  className={`pb-2 text-xs font-bold border-b-2 transition-all ${
                    findStopTab === 'nearme'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Stops Near Me
                </button>
              </div>

              {/* Body */}
              <div className="p-4 flex-1 overflow-y-auto space-y-3">
                {findStopTab === 'name' && (
                  <>
                    <div className="relative">
                      <Search size={16} className="text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search official stop name (e.g. Surathkal, Mulki)..."
                        value={stopSearchQuery}
                        onChange={(e) => setStopSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold border border-slate-200 outline-hidden focus:border-blue-600"
                      />
                    </div>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {searchedStops.map((stop) => (
                        <div
                          key={stop.stop_id}
                          className="p-2.5 rounded-xl border border-slate-100 hover:bg-blue-50/60 flex items-center justify-between transition-all"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-800">
                              {stop.stop_name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {stop.stop_name_kn} • {stop.locality}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentStop(stop.stop_name)
                                setFindStopOpen(false)
                              }}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold"
                            >
                              Set as Boarding
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDestination(stop.stop_name)
                                setFindStopOpen(false)
                              }}
                              className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold"
                            >
                              Set as Dest
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {findStopTab === 'landmark' && (
                  <>
                    <div className="relative">
                      <Search size={16} className="text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search landmark (e.g. AJ Hospital, NITK, Sri Krishna Matha)..."
                        value={stopSearchQuery}
                        onChange={(e) => setStopSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold border border-slate-200 outline-hidden focus:border-blue-600"
                      />
                    </div>

                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {searchedStops
                        .filter((s) => s.nearby_landmarks && s.nearby_landmarks.trim())
                        .map((stop) => (
                          <div
                            key={stop.stop_id}
                            className="p-2.5 rounded-xl border border-slate-100 hover:bg-blue-50/60 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">
                                📍 {stop.stop_name}
                              </span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCurrentStop(stop.stop_name)
                                    setFindStopOpen(false)
                                  }}
                                  className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold"
                                >
                                  Boarding
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDestination(stop.stop_name)
                                    setFindStopOpen(false)
                                  }}
                                  className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold"
                                >
                                  Destination
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              <strong>Landmarks:</strong> {stop.nearby_landmarks}
                            </p>
                          </div>
                        ))}
                    </div>
                  </>
                )}

                {findStopTab === 'nearme' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Find stops closest to your current physical location along the coastal corridor.
                      Location is only accessed on-demand when you tap the button below.
                    </p>

                    <button
                      type="button"
                      onClick={handleFindStopsNearMe}
                      disabled={nearMeLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                    >
                      <Crosshair size={16} />
                      <span>{nearMeLoading ? 'Detecting Location...' : 'Find Stops Near Me'}</span>
                    </button>

                    {nearMeError && (
                      <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl">
                        {nearMeError}
                      </p>
                    )}

                    {nearMeStops.length > 0 && (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pt-2">
                        {nearMeStops.map((stop) => (
                          <div
                            key={stop.stop_id}
                            className="p-2.5 rounded-xl border border-slate-100 hover:bg-blue-50/60 flex items-center justify-between"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-800">
                                {stop.stop_name}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                ~ {stop.distance_km} km away
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentStop(stop.stop_name)
                                setFindStopOpen(false)
                              }}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold"
                            >
                              Select
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* UTILITY MODALS: HELPDESK, FEEDBACK, CONTACT US                  */}
        {/* ============================================================== */}
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setActiveModal(null)}
            />
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-6 z-10 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-base text-slate-900">
                  {activeModal === 'helpdesk' && 'Helpdesk & Passenger Guide'}
                  {activeModal === 'feedback' && 'Passenger Feedback'}
                  {activeModal === 'contact' && 'Official Contact & Help'}
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {activeModal === 'helpdesk' && (
                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <p>Welcome to Karavali-Transit, the live passenger radar for coastal Karnataka.</p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 font-medium">
                    <p><strong>Step 1:</strong> Enter your boarding stop &amp; destination on the home screen.</p>
                    <p><strong>Step 2:</strong> View real-time incoming coastal buses and filter by Live or Scheduled.</p>
                    <p><strong>Step 3:</strong> Inspect the full route timetable and intermediate stops.</p>
                    <p><strong>Step 4:</strong> Track your selected bus on the live GPS map along the NH-66 highway.</p>
                  </div>
                </div>
              )}

              {activeModal === 'feedback' && (
                feedbackSuccess ? (
                  <div className="text-center py-6 space-y-2">
                    <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
                    <h4 className="text-sm font-extrabold text-slate-900">Thank You!</h4>
                    <p className="text-xs text-slate-500">
                      Your feedback has been saved to the PostgreSQL database.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackSuccess(false)
                        setActiveModal(null)
                      }}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitFeedback} className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        Your Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={feedbackName}
                        onChange={(e) => setFeedbackName(e.target.value)}
                        placeholder="e.g. Priya Rao"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs font-semibold border border-slate-200 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        value={feedbackEmail}
                        onChange={(e) => setFeedbackEmail(e.target.value)}
                        placeholder="e.g. priya@example.com"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs font-semibold border border-slate-200 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        Rating (1 to 5 Stars)
                      </label>
                      <select
                        value={feedbackRating}
                        onChange={(e) => setFeedbackRating(Number(e.target.value))}
                        className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold border border-slate-200 outline-hidden"
                      >
                        <option value={5}>⭐⭐⭐⭐⭐ (Excellent)</option>
                        <option value={4}>⭐⭐⭐⭐ (Very Good)</option>
                        <option value={3}>⭐⭐⭐ (Good)</option>
                        <option value={2}>⭐⭐ (Fair)</option>
                        <option value={1}>⭐ (Needs Improvement)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        Message / Suggestions *
                      </label>
                      <textarea
                        rows={3}
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Write your feedback regarding bus tracking or stops..."
                        className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs font-semibold border border-slate-200 outline-hidden"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={feedbackSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all"
                    >
                      {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </form>
                )
              )}

              {activeModal === 'contact' && (
                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <p>For operations, complaints or transit inquiries across Dakshina Kannada and Udupi districts:</p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Control Room</span>
                      <p className="font-extrabold text-slate-900">+91 824 222 0500</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Email</span>
                      <p className="font-extrabold text-slate-900">transit@karavali.gov.in</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Central Terminal</span>
                      <p className="font-medium text-slate-700">Statebank Service Bus Terminal, Mangaluru - 575001</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
