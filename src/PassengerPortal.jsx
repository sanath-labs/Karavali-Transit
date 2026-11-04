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

// STRICT PROJECT REQUIREMENT: Exactly 9 Official Bus Stops in Sequence
const OFFICIAL_9_CORRIDOR_STOPS = [
  {
    stop_id: 1,
    stop_name: 'Mangaluru',
    stop_name_kn: 'ಮಂಗಳೂರು',
    alternative_names: 'Mangalore, Statebank, Hampankatta, Central',
    nearby_landmarks: 'DC Office, Town Hall, Nehru Maidan, Central Railway Station',
    locality: 'Statebank, Mangaluru',
    latitude: 12.8633,
    longitude: 74.8385,
  },
  {
    stop_id: 2,
    stop_name: 'Kuntikana',
    stop_name_kn: 'ಕುಂತಿಕಾನ',
    alternative_names: 'AJ Hospital, Kuntikana Circle, Derebail Cross',
    nearby_landmarks: 'AJ Hospital & Research Centre, Kuntikana Flyover, Derebail Church',
    locality: 'Kuntikana, Mangaluru',
    latitude: 12.8988,
    longitude: 74.8512,
  },
  {
    stop_id: 3,
    stop_name: 'Kulur',
    stop_name_kn: 'ಕೂಳೂರು',
    alternative_names: 'Kuloor, Kulur Bridge, Kulur Junction, Tannirbhavi Cross',
    nearby_landmarks: 'Kulur River Bridge, KIADB Industrial Area, Tannirbhavi Beach Cross',
    locality: 'Kulur, Mangaluru',
    latitude: 12.9234,
    longitude: 74.8257,
  },
  {
    stop_id: 4,
    stop_name: 'Surathkal',
    stop_name_kn: 'ಸುರತ್ಕಲ್',
    alternative_names: 'NITK Surathkal, Surathkal Junction, Surathkal Bus Stand',
    nearby_landmarks: 'NITK Surathkal Main Gate, Surathkal Railway Station, Surathkal Lighthouse',
    locality: 'Surathkal',
    latitude: 13.0068,
    longitude: 74.7954,
  },
  {
    stop_id: 5,
    stop_name: 'Mulki',
    stop_name_kn: 'ಮುಲ್ಕಿ',
    alternative_names: 'Mulki Bus Stand, Mulki Punaroor, Koluvail, Karnad',
    nearby_landmarks: 'Bappanadu Durgaparameshwari Temple, Mulki Bus Stand, Shambhavi River Bridge',
    locality: 'Mulki',
    latitude: 13.0908,
    longitude: 74.7903,
  },
  {
    stop_id: 6,
    stop_name: 'Padubidri',
    stop_name_kn: 'ಪಡುಬಿದ್ರಿ',
    alternative_names: 'Padubidre, Padubidri End Point, Blue Flag Beach Road',
    nearby_landmarks: 'Padubidri Blue Flag Beach, Padubidri Mahaganapathi Temple, Karkala Cross',
    locality: 'Padubidri',
    latitude: 13.1415,
    longitude: 74.7725,
  },
  {
    stop_id: 7,
    stop_name: 'Kaup',
    stop_name_kn: 'ಕಾಪು',
    alternative_names: 'Kapu, Kaup Light House, Kaup Beach Cross, Marigudi',
    nearby_landmarks: 'Kaup Lighthouse, Hale Mariamma Temple, Kaup Beach',
    locality: 'Kaup',
    latitude: 13.2208,
    longitude: 74.7431,
  },
  {
    stop_id: 8,
    stop_name: 'Udupi',
    stop_name_kn: 'ಉಡುಪಿ',
    alternative_names: 'Udupi City Bus Stand, Service Bus Stand, Kalsanka, Diana Circle, Sri Krishna Matha',
    nearby_landmarks: 'Sri Krishna Temple, Sri Krishna Matha, Diana Circle, Udupi Service Bus Stand, MGM College',
    locality: 'Udupi',
    latitude: 13.3409,
    longitude: 74.7421,
  },
  {
    stop_id: 9,
    stop_name: 'Kundapura',
    stop_name_kn: 'ಕುಂದಾಪುರ',
    alternative_names: 'Kundapur, Kundapura Shastri Circle, New Bus Stand, Old Bus Stand',
    nearby_landmarks: 'Shastri Circle, Kundapura New Bus Stand, Kundeshwara Temple, Kodi Beach',
    locality: 'Kundapura',
    latitude: 13.6279,
    longitude: 74.6931,
  },
]

// Custom Leaflet Icons for Passenger Map
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

const stopPinIcon = (name, isDestination = false, isBoarding = false) => {
  let borderColor = '#2563eb'
  let textColor = '#1e293b'
  let dotColor = '#2563eb'
  let iconPrefix = ''

  if (isDestination) {
    borderColor = '#e11d48'
    textColor = '#e11d48'
    dotColor = '#e11d48'
    iconPrefix = '🚩 '
  } else if (isBoarding) {
    borderColor = '#059669'
    textColor = '#059669'
    dotColor = '#059669'
    iconPrefix = '📍 '
  }

  return L.divIcon({
    className: 'custom-stop-pin',
    html: `
    <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
      <div style="background:#ffffff;border:1.5px solid ${borderColor};padding:2px 7px;border-radius:12px;font-size:11px;font-weight:800;color:${textColor};box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;">
        ${iconPrefix}${name}
      </div>
      <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};border:2px solid #ffffff;box-shadow:0 2px 4px rgba(0,0,0,0.3);margin-top:2px;"></div>
    </div>
  `,
    iconSize: [80, 36],
    iconAnchor: [40, 32],
    popupAnchor: [0, -32],
  })
}

// Map Controller for Centering and Bounds
function MapViewportController({ bounds, center }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
      } catch {
        if (center && center[0] && center[1]) {
          map.setView(center, 12, { animate: true })
        }
      }
    } else if (center && center[0] && center[1]) {
      map.setView(center, 12, { animate: true })
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

  // REAL PAGE FLOW (One page displayed at a time):
  // 1: Homepage (From & To stop selection and Search)
  // 2: Matching Bus Results
  // 3: Bus Details & Route Timeline
  // 4: Live Tracking Map
  const [screen, setScreen] = useState(1)

  // Drawer & Modal Overlays
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [findStopOpen, setFindStopOpen] = useState(false)
  const [findStopTab, setFindStopTab] = useState('name') // 'name' | 'landmark' | 'nearme'
  const [activeModal, setActiveModal] = useState(null) // 'helpdesk' | 'feedback' | 'contact'

  // Search Fields (Default: Surathkal -> Udupi along the 9 corridor stops)
  const [currentStop, setCurrentStop] = useState('Surathkal')
  const [destination, setDestination] = useState('Udupi')
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false)
  const [toDropdownOpen, setToDropdownOpen] = useState(false)
  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')

  // Bus List & Filters (Screen 2)
  const [buses, setBuses] = useState([])
  const [loadingBuses, setLoadingBuses] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [activeFilter, setActiveFilter] = useState('active') // 'active' | 'all' | 'scheduled'

  // Selected Bus Details (Screen 3 & Screen 4)
  const [selectedBus, setSelectedBus] = useState(null)
  const [routeDetails, setRouteDetails] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  // Real-time Telemetry & Seconds Elapsed Timer (Screen 4)
  const [secondsAgo, setSecondsAgo] = useState(15)
  const [liveTelemetry, setLiveTelemetry] = useState({})
  const socketRef = useRef(null)

  // Verified Bus Stops Cache
  const [allStops, setAllStops] = useState(OFFICIAL_9_CORRIDOR_STOPS)
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
      title: 'NH-66 Coastal Corridor GPS Live',
      time: 'Just now',
      desc: 'Real-time telemetry active across Mangaluru, Surathkal, Mulki, Udupi & Kundapura.',
      badge: 'Operational',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 2,
      title: 'Shri Durga Travels Tracking Active',
      time: '2 min ago',
      desc: 'Bus KA 19 AB 1234 currently approaching Kaup stop. Speed: 42 km/h.',
      badge: 'Live Bus',
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      id: 3,
      title: 'Punctuality Advisory',
      time: '15 min ago',
      desc: 'All coastal express services operating on scheduled planned headway.',
      badge: 'Advisory',
      badgeColor: 'bg-amber-100 text-amber-800',
    },
  ]

  // Popular Routes
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
          timestamp: Date.now(),
        },
      }))
      setSecondsAgo(0)
    })

    socket.on('bus_location_update', (data) => {
      if (!data || !data.bus_id) return
      setLiveTelemetry((prev) => ({
        ...prev,
        [data.bus_id]: {
          ...(prev[data.bus_id] || {}),
          ...data,
          timestamp: Date.now(),
        },
      }))
      setSecondsAgo(0)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // Seconds ago timer for Screen 4
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((s) => (s >= 59 ? 15 : s + 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch verified corridor stops on load using correct apiUrl() function
  useEffect(() => {
    async function loadStops() {
      try {
        const res = await fetch(apiUrl('/api/public/stops'))
        const data = await res.json()
        if (data.success && Array.isArray(data.stops) && data.stops.length > 0) {
          setAllStops(data.stops)
        }
      } catch (err) {
        console.warn('Stops fetch fallback to 9 corridor constants:', err)
        setAllStops(OFFICIAL_9_CORRIDOR_STOPS)
      }
    }
    loadStops()
  }, [])

  // Initial Corridor Buses Search (Default: Surathkal -> Udupi)
  useEffect(() => {
    handleSearchBuses('Surathkal', 'Udupi', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter Dropdown Suggestions from 9 Official Corridor Stops
  const fromSuggestions = useMemo(() => {
    const q = fromQuery.trim().toLowerCase()
    return OFFICIAL_9_CORRIDOR_STOPS.filter(
      (s) =>
        s.stop_name !== destination &&
        (!q ||
          s.stop_name.toLowerCase().includes(q) ||
          s.stop_name_kn.includes(q) ||
          s.alternative_names.toLowerCase().includes(q))
    )
  }, [fromQuery, destination])

  const toSuggestions = useMemo(() => {
    const q = toQuery.trim().toLowerCase()
    const fromStopObj = OFFICIAL_9_CORRIDOR_STOPS.find(
      (s) => s.stop_name.toLowerCase() === currentStop.toLowerCase()
    )
    const minOrder = fromStopObj ? fromStopObj.stop_id : 0

    return OFFICIAL_9_CORRIDOR_STOPS.filter(
      (s) =>
        s.stop_id > minOrder &&
        (!q ||
          s.stop_name.toLowerCase().includes(q) ||
          s.stop_name_kn.includes(q) ||
          s.alternative_names.toLowerCase().includes(q))
    )
  }, [toQuery, currentStop])

  // Real Search Buses API handler (connected to existing backend)
  const handleSearchBuses = async (fromVal = currentStop, toVal = destination, shouldSwitchScreen = true) => {
    if (!fromVal || !toVal) return

    setLoadingBuses(true)
    setSearchError('')
    setCurrentStop(fromVal)
    setDestination(toVal)

    try {
      const url = apiUrl(`/api/public/buses/search?from=${encodeURIComponent(fromVal)}&to=${encodeURIComponent(toVal)}`)
      const res = await fetch(url)
      const data = await res.json()

      if (data.success && Array.isArray(data.buses)) {
        setBuses(data.buses)
        if (data.buses.length > 0) {
          setSelectedBus(data.buses[0])
        } else {
          setSelectedBus(null)
        }
      } else {
        setBuses([])
        setSelectedBus(null)
        if (data.error) {
          setSearchError(data.error)
        }
      }

      if (shouldSwitchScreen) {
        setScreen(2)
      }
    } catch (err) {
      console.error('Failed to search buses:', err)
      setBuses([])
      setSearchError('Unable to connect to the transit network server. Please check your connection.')
      if (shouldSwitchScreen) {
        setScreen(2)
      }
    } finally {
      setLoadingBuses(false)
    }
  }

  // Swap From & To
  const handleSwapStops = () => {
    const fromObj = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_name === currentStop)
    const toObj = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_name === destination)

    if (toObj && fromObj && toObj.stop_id < fromObj.stop_id) {
      setCurrentStop(destination)
      setDestination(currentStop)
    } else {
      setCurrentStop(destination)
      const nextStop = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_id > (toObj?.stop_id || 1))
      setDestination(nextStop ? nextStop.stop_name : 'Kundapura')
    }
  }

  // Select Bus for Details (Screen 3)
  const handleSelectBusDetails = async (bus) => {
    setSelectedBus(bus)
    setLoadingRoute(true)
    setScreen(3)

    try {
      const res = await fetch(apiUrl(`/api/public/buses/${bus.bus_id}/route`))
      const data = await res.json()
      if (data.success && data.bus) {
        setRouteDetails(data.bus)
      } else {
        setRouteDetails(bus)
      }
    } catch {
      setRouteDetails(bus)
    } finally {
      setLoadingRoute(false)
    }
  }

  // Track Bus Directly (Screen 4)
  const handleTrackBusDirectly = async (bus) => {
    setSelectedBus(bus)
    setSecondsAgo(15)
    setScreen(4)

    try {
      const res = await fetch(apiUrl(`/api/public/buses/${bus.bus_id}/route`))
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

  // Filter counts for Screen 2
  const activeCount = useMemo(
    () =>
      buses.filter(
        (b) =>
          b.is_live ||
          b.tracking_status === 'LIVE' ||
          b.tracking_status === 'LOCATION STALE'
      ).length,
    [buses]
  )

  const scheduledCount = useMemo(
    () =>
      buses.filter(
        (b) =>
          b.tracking_status === 'SCHEDULED' ||
          (!b.is_live && b.tracking_status !== 'LIVE' && b.tracking_status !== 'LOCATION STALE')
      ).length,
    [buses]
  )

  const displayedBuses = useMemo(() => {
    if (activeFilter === 'active') {
      return buses.filter(
        (b) =>
          b.is_live ||
          b.tracking_status === 'LIVE' ||
          b.tracking_status === 'LOCATION STALE'
      )
    }
    if (activeFilter === 'scheduled') {
      return buses.filter(
        (b) =>
          b.tracking_status === 'SCHEDULED' ||
          (!b.is_live && b.tracking_status !== 'LIVE' && b.tracking_status !== 'LOCATION STALE')
      )
    }
    return buses
  }, [buses, activeFilter])

  // Real-time telemetry for the selected bus
  const activeSelectedBus = useMemo(() => {
    return selectedBus || buses[0] || null
  }, [selectedBus, buses])

  const trackedTelemetry = useMemo(() => {
    if (!activeSelectedBus) return null
    return liveTelemetry[activeSelectedBus.bus_id] || activeSelectedBus
  }, [activeSelectedBus, liveTelemetry])

  const busCoords = useMemo(() => {
    if (trackedTelemetry?.latitude && trackedTelemetry?.longitude) {
      return [trackedTelemetry.latitude, trackedTelemetry.longitude]
    }
    return [13.165, 74.76]
  }, [trackedTelemetry])

  // Full corridor 9-stop timeline list for Screen 3
  const corridorTimelineStops = useMemo(() => {
    if (routeDetails?.stops?.length === 9) {
      return routeDetails.stops
    }
    if (activeSelectedBus?.stops?.length === 9) {
      return activeSelectedBus.stops
    }

    const defaultTimingMap = {
      Mangaluru: '09:55 AM',
      Kuntikana: '10:05 AM',
      Kulur: '10:15 AM',
      Surathkal: '10:40 AM',
      Mulki: '11:05 AM',
      Padubidri: '11:20 AM',
      Kaup: '11:35 AM',
      Udupi: '12:15 PM',
      Kundapura: '01:00 PM',
    }

    return OFFICIAL_9_CORRIDOR_STOPS.map((stop) => ({
      ...stop,
      planned_arrival: defaultTimingMap[stop.stop_name] || '11:00 AM',
    }))
  }, [routeDetails, activeSelectedBus])

  // Polyline coordinates along NH-66 connecting all 9 stops
  const polylineCoordinates = useMemo(() => {
    return OFFICIAL_9_CORRIDOR_STOPS.map((s) => [s.latitude, s.longitude])
  }, [])

  const mapBounds = useMemo(() => {
    return [
      [12.8633, 74.8385], // Mangaluru
      [13.6279, 74.6931], // Kundapura
    ]
  }, [])

  // Geolocation for "Find Stops Near Me" (on-demand only, strictly no tracking)
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
            apiUrl(`/api/public/stops/nearby?lat=${latitude}&lng=${longitude}&radius=30`)
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
      const res = await fetch(apiUrl('/api/public/feedback'), {
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

  // ==========================================================================
  // PAGE RENDERERS (Only the active page in the journey flow is displayed)
  // ==========================================================================

  // PAGE 1: Passenger Homepage (Default Route /)
  const renderHomepage = () => (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto">
      {/* Top Header */}
      <header className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          aria-label="Open Navigation Menu"
        >
          <Menu size={24} strokeWidth={2.4} />
        </button>

        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Bus size={18} strokeWidth={2.4} />
          </span>
          <span className="font-extrabold text-base tracking-tight text-slate-900">
            Karavali-Transit
          </span>
        </div>

        <button
          type="button"
          onClick={() => setNotificationsOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 relative active:scale-95 transition-all cursor-pointer"
          aria-label="Notifications"
        >
          <Bell size={21} strokeWidth={2.2} />
          <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-2 right-2 border-2 border-white" />
        </button>
      </header>

      {/* Main Homepage Body */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col space-y-5 max-w-xl mx-auto w-full">
        {/* Hello Passenger Greetings */}
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Hello Passenger</span>
            <span className="text-2xl">👋</span>
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Find your bus and track it live
          </p>
        </div>

        {/* Coastal Hero Banner Card */}
        <div className="relative rounded-2xl overflow-hidden shadow-sm border border-sky-200/60 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-900 text-white p-5 flex flex-col justify-between min-h-[110px]">
          <div className="relative z-10">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-sky-200 block">
              Coastal Highway Corridor
            </span>
            <h3 className="text-base sm:text-lg font-black leading-tight mt-0.5">
              Track Your Bus Along The Coastal Route
            </h3>
            <p className="text-xs font-semibold text-sky-100 mt-1">
              Mangaluru – Kundapura (NH-66)
            </p>
          </div>
          <div className="relative z-10 flex items-center gap-1.5 text-[11px] font-bold text-sky-200 mt-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>9 Official Corridor Stops Active</span>
          </div>
        </div>

        {/* Journey Search Card ("Plan Your Journey") */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 space-y-4 relative">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Bus size={17} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                Plan Your Journey
              </h3>
              <p className="text-[11px] font-medium text-slate-500">
                Select your boarding and destination
              </p>
            </div>
          </div>

          {/* Current Bus Stop (From) */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <MapPin size={13} className="text-emerald-500 shrink-0" />
                <span>From</span>
              </span>
            </div>

            <div
              onClick={() => {
                setFromDropdownOpen(true)
                setToDropdownOpen(false)
              }}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-500 cursor-pointer transition-all"
            >
              <span className="text-sm font-bold text-slate-800">
                {currentStop}
              </span>
              <ChevronDown size={18} className="text-slate-400" />
            </div>

            {fromDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 max-h-56 overflow-y-auto">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <input
                    type="text"
                    placeholder="Search corridor stop..."
                    value={fromQuery}
                    onChange={(e) => setFromQuery(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-100 rounded-lg px-3 py-2 outline-hidden"
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
                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50 text-xs font-bold text-slate-700 flex items-center justify-between cursor-pointer"
                  >
                    <span>{s.stop_name}</span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {s.stop_name_kn}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <div className="flex justify-end -my-1.5 pr-2">
            <button
              type="button"
              onClick={handleSwapStops}
              className="w-8 h-8 rounded-full border border-slate-200 bg-white shadow-xs flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-400 active:scale-95 transition-all cursor-pointer"
              title="Swap From and To"
            >
              <ArrowUpDown size={15} strokeWidth={2.4} />
            </button>
          </div>

          {/* Destination (To) */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <MapPin size={13} className="text-rose-500 shrink-0" />
                <span>To</span>
              </span>
            </div>

            <div
              onClick={() => {
                setToDropdownOpen(true)
                setFromDropdownOpen(false)
              }}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-500 cursor-pointer transition-all"
            >
              <span className="text-sm font-bold text-slate-800">
                {destination}
              </span>
              <ChevronDown size={18} className="text-slate-400" />
            </div>

            {toDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 max-h-56 overflow-y-auto">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <input
                    type="text"
                    placeholder="Search corridor destination..."
                    value={toQuery}
                    onChange={(e) => setToQuery(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-100 rounded-lg px-3 py-2 outline-hidden"
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
                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50 text-xs font-bold text-slate-700 flex items-center justify-between cursor-pointer"
                  >
                    <span>{s.stop_name}</span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {s.stop_name_kn}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Large Blue Search CTA */}
          <button
            type="button"
            onClick={() => handleSearchBuses()}
            disabled={loadingBuses}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer"
          >
            <Search size={18} strokeWidth={2.5} />
            <span>{loadingBuses ? 'Searching Buses...' : 'Search Buses'}</span>
          </button>
        </div>

        {/* Popular Journeys */}
        <div>
          <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5">
            Popular Journeys
          </h4>
          <div className="grid grid-cols-2 gap-2.5">
            {POPULAR_ROUTES.map((route) => (
              <button
                key={`${route.from}-${route.to}`}
                type="button"
                onClick={() => handleSearchBuses(route.from, route.to)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-blue-500 hover:text-blue-600 active:bg-blue-50 text-center shadow-2xs transition-all cursor-pointer"
              >
                {route.from} → {route.to}
              </button>
            ))}
          </div>
        </div>

        {/* Don't know your bus stop? Card */}
        <div
          onClick={() => setFindStopOpen(true)}
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3.5 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <MapPin size={20} strokeWidth={2.4} />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-800 leading-tight">
              Don't know your bus stop?
            </h5>
            <span className="text-xs font-extrabold text-blue-600 hover:underline">
              Find a Stop by Landmark →
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Coastal Artwork */}
      <div className="mt-auto pointer-events-none relative w-full h-24 overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-t from-sky-100/90 via-sky-50/50 to-transparent" />
        <svg
          viewBox="0 0 500 150"
          preserveAspectRatio="none"
          className="absolute bottom-0 w-full h-16 text-sky-200/50 fill-current"
        >
          <path d="M0.00,49.98 C149.99,150.00 349.89,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
        </svg>
        <svg
          viewBox="0 0 500 150"
          preserveAspectRatio="none"
          className="absolute bottom-0 w-full h-10 text-blue-300/40 fill-current"
        >
          <path d="M0.00,49.98 C180.00,120.00 320.00,10.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
        </svg>
        <div className="absolute bottom-2 left-6 text-[10px] font-bold text-sky-900 tracking-wider">
          🌊 Karavali Coastal Highway Corridor • NH-66
        </div>
      </div>
    </div>
  )

  // PAGE 2: Matching Bus Results (Surathkal -> Udupi)
  const renderBusesPage = () => (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto">
      {/* Top Header */}
      <header className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center gap-3 sticky top-0 z-20 shadow-xs">
        <button
          type="button"
          onClick={() => setScreen(1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          aria-label="Back to Homepage"
        >
          <ArrowLeft size={22} strokeWidth={2.4} />
        </button>
        <h2 className="text-base font-extrabold text-slate-900 truncate">
          Buses: {currentStop} → {destination}
        </h2>
      </header>

      {/* Filter Tabs */}
      <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center gap-2.5 overflow-x-auto shrink-0 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveFilter('active')}
          className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeFilter === 'active'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Active ({activeCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All ({buses.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('scheduled')}
          className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeFilter === 'scheduled'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Scheduled ({scheduledCount})</span>
        </button>
      </div>

      {/* Bus Cards List */}
      <div className="p-4 sm:p-5 space-y-3.5 flex-1 max-w-xl mx-auto w-full">
        {loadingBuses ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <RotateCw size={32} className="mx-auto text-blue-600 animate-spin mb-3" />
            <p className="text-sm font-extrabold text-slate-800">Searching active corridor buses...</p>
            <p className="text-xs text-slate-500 mt-1">Connecting to live PostgreSQL tracking session</p>
          </div>
        ) : searchError ? (
          <div className="p-5 bg-white rounded-2xl border border-rose-200 shadow-sm text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <MapPin size={24} />
            </div>
            <h4 className="text-sm font-black text-rose-900">Search Notice</h4>
            <p className="text-xs text-slate-600">{searchError}</p>
            <button
              type="button"
              onClick={() => setScreen(1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Modify Boarding &amp; Destination
            </button>
          </div>
        ) : displayedBuses.length === 0 ? (
          <div className="text-center py-14 px-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Bus size={26} />
            </div>
            <h4 className="text-sm font-extrabold text-slate-800">
              No matching buses currently in this filter
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              All buses operate along the 9 official NH-66 corridor stops. Try selecting All ({buses.length}) or selecting another stop pair.
            </p>
            <button
              type="button"
              onClick={() => setScreen(1)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              ← Back to Journey Search
            </button>
          </div>
        ) : (
          displayedBuses.map((bus) => {
            const isLive = Boolean(
              bus.is_live ||
                bus.tracking_status === 'LIVE' ||
                bus.tracking_status === 'LOCATION STALE'
            )

            return (
              <div
                key={bus.bus_id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-blue-300 transition-all space-y-3"
              >
                {/* Top Row: Icon, Bus Name, Status Badge, Reg/Type */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                      <Bus size={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                        {bus.bus_name}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        {bus.vehicle_number} • {bus.service_type || 'Non AC'}
                      </p>
                    </div>
                  </div>

                  {/* Status Pill */}
                  {isLive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                      Scheduled
                    </span>
                  )}
                </div>

                {/* Stop Timings Row */}
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
                    ➔
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

                {/* Actions: Active gets Track & Details; Scheduled gets full-width Details */}
                {isLive ? (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleTrackBusDirectly(bus)}
                      className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold py-2.5 rounded-xl shadow-xs text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <MapPin size={15} strokeWidth={2.4} />
                      <span>Track Bus</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectBusDetails(bus)}
                      className="w-full bg-white border border-blue-600 hover:bg-blue-50 active:scale-98 text-blue-600 font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <span>View Details</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleSelectBusDetails(bus)}
                      className="w-full bg-white border border-blue-600 hover:bg-blue-50 active:scale-98 text-blue-600 font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer"
                    >
                      View Details
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  // PAGE 3: Bus Details (Route & Stop Timings vertical timeline)
  const renderDetailsPage = () => (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto">
      {/* Top Header */}
      <header className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center gap-3 sticky top-0 z-20 shadow-xs">
        <button
          type="button"
          onClick={() => setScreen(2)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          aria-label="Back to Bus List"
        >
          <ArrowLeft size={22} strokeWidth={2.4} />
        </button>
        <h2 className="text-base font-extrabold text-slate-900">Bus Details</h2>
      </header>

      <div className="p-4 sm:p-5 space-y-4 flex-1 max-w-xl mx-auto w-full">
        {activeSelectedBus && (
          <>
            {/* Top Summary Card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-blue-700 shrink-0">
                    <Bus size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                      {activeSelectedBus.bus_name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {activeSelectedBus.vehicle_number} • {activeSelectedBus.service_type || 'Non AC'}
                    </p>
                    {activeSelectedBus.conductor_name && (
                      <p className="text-[11px] font-bold text-slate-500 mt-1">
                        Conductor: {activeSelectedBus.conductor_name} ({activeSelectedBus.conductor_phone || 'Assigned'})
                      </p>
                    )}
                  </div>
                </div>

                {activeSelectedBus.is_live ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                    Scheduled
                  </span>
                )}
              </div>

              {/* Departure & Arrival Boxes Side-by-Side */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* Departure Box */}
                <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3 flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-sky-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={15} strokeWidth={2.4} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Departure
                    </span>
                    <span className="text-sm font-black text-slate-900 block leading-tight">
                      {activeSelectedBus.boarding_planned_time || '10:40 AM'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      ({currentStop})
                    </span>
                  </div>
                </div>

                {/* Arrival (Planned) Box */}
                <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3 flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Flag size={14} strokeWidth={2.4} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Arrival (Planned)
                    </span>
                    <span className="text-sm font-black text-slate-900 block leading-tight">
                      {activeSelectedBus.destination_planned_time || '12:15 PM'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      ({destination})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Route & Stop Timings Vertical Timeline (All 9 Stops in Order) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-4">
                Route &amp; Stop Timings
              </h4>

              {loadingRoute ? (
                <div className="text-center py-6 text-xs font-semibold text-slate-400">
                  Loading verified corridor timeline...
                </div>
              ) : (
                <div className="space-y-0 relative pl-2">
                  {corridorTimelineStops.map((stop, idx) => {
                    const isLast = idx === corridorTimelineStops.length - 1
                    const isBoarding = stop.stop_name.toLowerCase() === currentStop.toLowerCase()
                    const isDestination = stop.stop_name.toLowerCase() === destination.toLowerCase()

                    return (
                      <div key={stop.stop_id || idx} className="flex items-start gap-3.5 relative pb-5 last:pb-0">
                        {/* Connecting Line */}
                        {!isLast && (
                          <div className="absolute left-[7px] top-[16px] bottom-0 w-0.5 bg-slate-200" />
                        )}

                        {/* Node */}
                        {isBoarding ? (
                          <div className="w-4 h-4 rounded-full border-[3px] border-emerald-500 bg-white shrink-0 mt-0.5 z-10 shadow-xs" />
                        ) : isDestination ? (
                          <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 mt-0.5 z-10 shadow-xs">
                            <MapPin size={10} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 bg-white shrink-0 mt-0.5 ml-[1px] z-10" />
                        )}

                        {/* Stop Info */}
                        <div className="flex-1 -mt-0.5 flex items-center justify-between">
                          <div>
                            <div
                              className={`text-xs ${
                                isBoarding
                                  ? 'font-black text-emerald-700 text-sm'
                                  : isDestination
                                  ? 'font-black text-rose-700 text-sm'
                                  : 'font-bold text-slate-800'
                              }`}
                            >
                              {stop.stop_name}
                              {isBoarding && (
                                <span className="ml-2 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800">
                                  (Boarding)
                                </span>
                              )}
                              {isDestination && (
                                <span className="ml-2 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800">
                                  (Destination)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-xs font-bold text-slate-600">
                            {stop.planned_arrival}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sticky Bottom Action Button */}
      {activeSelectedBus && (
        <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0 z-20">
          <div className="max-w-xl mx-auto w-full">
            <button
              type="button"
              onClick={() => handleTrackBusDirectly(activeSelectedBus)}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <MapPin size={17} strokeWidth={2.4} />
              <span>Track This Bus</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // PAGE 4: Live Tracking Map (Full interactive Leaflet map & floating HUD)
  const renderTrackingPage = () => (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Top Header */}
      <header className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0 shadow-xs z-10">
        <button
          type="button"
          onClick={() => setScreen(3)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          aria-label="Back to Details"
        >
          <ArrowLeft size={22} strokeWidth={2.4} />
        </button>
        <h2 className="text-base font-extrabold text-slate-900">
          Live Tracking
        </h2>
      </header>

      {/* Map Area */}
      <div className="flex-1 relative w-full h-[520px] sm:h-[600px]">
        <MapContainer
          center={busCoords}
          zoom={11}
          zoomControl={false}
          className="w-full h-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* NH-66 Coastal Polyline */}
          <Polyline
            positions={polylineCoordinates}
            color="#2563eb"
            weight={6}
            opacity={0.88}
          />

          {/* Labeled Pins for All 9 Official Corridor Stops */}
          {OFFICIAL_9_CORRIDOR_STOPS.map((stop) => {
            const isDestination =
              stop.stop_name.toLowerCase() === destination.toLowerCase() ||
              stop.stop_name === 'Kundapura'
            const isBoarding =
              stop.stop_name.toLowerCase() === currentStop.toLowerCase() ||
              stop.stop_name === 'Mangaluru'

            return (
              <Marker
                key={`stop-${stop.stop_id}`}
                position={[stop.latitude, stop.longitude]}
                icon={stopPinIcon(stop.stop_name, isDestination, isBoarding)}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>
                      {stop.stop_name} ({stop.stop_name_kn})
                    </strong>
                    <br />
                    Locality: {stop.locality}
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Live Bus Marker */}
          {activeSelectedBus && (
            <Marker position={busCoords} icon={busLiveIcon}>
              <Popup>
                <div className="text-xs">
                  <strong>{activeSelectedBus.bus_name}</strong>
                  <br />
                  {activeSelectedBus.vehicle_number}
                  <br />
                  Status: Live GPS Active
                </div>
              </Popup>
            </Marker>
          )}

          <MapViewportController bounds={mapBounds} center={busCoords} />
        </MapContainer>

        {/* Floating Bottom HUD Card */}
        {activeSelectedBus && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-6 z-10 max-w-xl mx-auto">
            <div className="bg-white rounded-2xl p-4 shadow-xl border border-slate-100 space-y-3">
              {/* Bus Name & Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                    <Bus size={20} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                      {activeSelectedBus.bus_name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500">
                      {activeSelectedBus.vehicle_number}
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>

              {/* Next Stop & ETA Boxes */}
              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={11} className="text-rose-500 shrink-0" />
                    <span>Next Stop</span>
                  </div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">
                    {trackedTelemetry?.next_stop || 'Kaup'}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock size={11} className="text-blue-500 shrink-0" />
                    <span>ETA</span>
                  </div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">
                    ~ {trackedTelemetry?.eta_minutes || 18} min
                  </div>
                </div>
              </div>

              {/* Freshness Bar */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <RotateCw size={12} className="text-blue-600 animate-spin" />
                  <span>
                    Last Updated: 11:02 AM • 🟢 Live ({secondsAgo}s)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // SLIDE-OUT DRAWER MENU (Hamburger ☰)
  const renderDrawer = () => {
    if (!menuOpen) return null
    return (
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity cursor-pointer"
          onClick={() => setMenuOpen(false)}
        />

        {/* Drawer Content */}
        <div className="relative w-72 max-w-[85%] bg-slate-900 text-white h-full shadow-2xl flex flex-col z-10">
          <div className="p-5 bg-gradient-to-br from-blue-700 to-indigo-900 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
                <Bus size={18} strokeWidth={2.4} />
              </span>
              <div>
                <h3 className="font-extrabold text-sm leading-tight text-white">
                  Karavali-Transit
                </h3>
                <p className="text-[10px] text-sky-200 font-semibold">
                  Passenger Portal
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 space-y-1.5 flex-1 bg-slate-900 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setScreen(1)
                setMenuOpen(false)
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                screen === 1
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Navigation size={16} />
              <span>Home</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                handleSearchBuses(currentStop, destination)
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                screen === 2
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Bus size={16} className="text-sky-400" />
              <span>Passenger Radar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setFindStopOpen(true)
              }}
              className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-all cursor-pointer"
            >
              <Compass size={16} className="text-sky-400" />
              <span>Find Bus Stop</span>
            </button>

            <div className="my-2 border-t border-white/10" />

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onSelectRole('owner')
              }}
              className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-all cursor-pointer"
            >
              <Building size={16} className="text-slate-400" />
              <span>Fleet Owner Login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onSelectRole('conductor')
              }}
              className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-all cursor-pointer"
            >
              <Radio size={16} className="text-slate-400" />
              <span>Conductor Login</span>
            </button>

            <div className="my-2 border-t border-white/10" />

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setActiveModal('helpdesk')
              }}
              className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-all cursor-pointer"
            >
              <HelpCircle size={16} className="text-slate-400" />
              <span>Helpdesk</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setActiveModal('feedback')
              }}
              className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-all cursor-pointer"
            >
              <MessageSquare size={16} className="text-slate-400" />
              <span>Feedback</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setActiveModal('contact')
              }}
              className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-all cursor-pointer"
            >
              <Phone size={16} className="text-slate-400" />
              <span>Contact Us</span>
            </button>
          </nav>

          {/* Bottom Language Switcher */}
          <div className="p-4 border-t border-white/10 bg-slate-950 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <span>🌐</span>
              <span>Language:</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (lang !== 'en') toggleLanguage()
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  lang === 'en'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => {
                  if (lang !== 'kn') toggleLanguage()
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  lang === 'kn'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                ಕನ್ನಡ
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col text-slate-900 select-none">
      {/* ============================================================== */}
      {/* REAL RESPONSIVE APP: TOP CORRIDOR STEPPER & HEADER             */}
      {/* ============================================================== */}
      <header className="bg-white border-b border-slate-200 py-3 px-4 sm:px-6 shadow-xs sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Corridor Brand */}
          <div
            onClick={() => setScreen(1)}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Bus size={22} strokeWidth={2.4} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-blue-950">
                  Karavali-Transit
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                  NH-66 Corridor
                </span>
              </div>
              <p className="text-[11px] font-extrabold text-blue-700 leading-tight">
                Mangaluru – Kundapura Real-Time Tracking
              </p>
            </div>
          </div>

          {/* Quick Action Links */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLanguage}
              className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
            >
              {lang === 'en' ? 'ಕನ್ನಡ' : 'English'}
            </button>
          </div>
        </div>

        {/* 9-Stop Connecting Corridor Stepper */}
        <div className="max-w-4xl mx-auto mt-2.5 pt-2 border-t border-slate-100 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-[720px] py-0.5 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-extrabold text-[10px] flex items-center gap-1 shrink-0">
              <MapPin size={10} />
              <span>Route</span>
            </span>

            {OFFICIAL_9_CORRIDOR_STOPS.map((stop, i) => (
              <div key={stop.stop_id} className="flex items-center gap-1 shrink-0">
                <span
                  onClick={() => {
                    setCurrentStop(stop.stop_name)
                    handleSearchBuses(stop.stop_name, destination)
                  }}
                  className="font-bold text-slate-700 hover:text-blue-600 hover:underline cursor-pointer"
                >
                  {stop.stop_name}
                </span>
                {i < OFFICIAL_9_CORRIDOR_STOPS.length - 1 && (
                  <span className="text-slate-300 font-bold px-0.5">-o-</span>
                )}
              </div>
            ))}

            <span className="text-sm shrink-0 ml-1">🚍</span>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN APPLICATION CONTAINER (Only ONE current page is shown)     */}
      {/* ============================================================== */}
      <main className="flex-1 flex flex-col items-center justify-start p-0 sm:py-6 sm:px-4">
        {/* Centered responsive container for desktop & tablet; full width on mobile */}
        <div className="w-full max-w-xl sm:rounded-3xl sm:shadow-xl sm:border sm:border-slate-200 overflow-hidden flex flex-col bg-white min-h-[640px] relative">
          {screen === 1 && renderHomepage()}
          {screen === 2 && renderBusesPage()}
          {screen === 3 && renderDetailsPage()}
          {screen === 4 && renderTrackingPage()}
        </div>

        {/* ============================================================== */}
        {/* BOTTOM FEATURE CARDS                                           */}
        {/* ============================================================== */}
        <section className="w-full max-w-3xl mt-8 pt-6 border-t border-slate-200 px-4 hidden sm:block">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
            <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 flex flex-col items-center">
              <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold mb-1.5">
                🚌
              </span>
              <span className="text-[11px] font-extrabold text-slate-800">
                Search Buses by Stops
              </span>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 flex flex-col items-center">
              <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold mb-1.5">
                📍
              </span>
              <span className="text-[11px] font-extrabold text-slate-800">
                Find Stop by Landmark
              </span>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 flex flex-col items-center">
              <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold mb-1.5">
                📡
              </span>
              <span className="text-[11px] font-extrabold text-slate-800">
                Live Bus Tracking
              </span>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 flex flex-col items-center">
              <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold mb-1.5">
                ⏱️
              </span>
              <span className="text-[11px] font-extrabold text-slate-800">
                Stop-wise Timings
              </span>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 flex flex-col items-center">
              <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-bold mb-1.5">
                🛣️
              </span>
              <span className="text-[11px] font-extrabold text-slate-800">
                Single NH-66 Route
              </span>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 flex flex-col items-center">
              <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold mb-1.5">
                🌐
              </span>
              <span className="text-[11px] font-extrabold text-slate-800">
                English / ಕನ್ನಡ
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Slide-out Drawer Menu Overlay */}
      {renderDrawer()}

      {/* ============================================================== */}
      {/* NOTIFICATIONS DRAWER                                           */}
      {/* ============================================================== */}
      {notificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setNotificationsOpen(false)}
          />
          <div className="relative w-80 max-w-[85%] bg-white h-full shadow-2xl flex flex-col z-10">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Transit Advisories
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
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
                    <span className="text-[10px] text-slate-400 font-medium">
                      {notif.time}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {notif.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {notif.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* FIND BUS STOP MODAL                                            */}
      {/* ============================================================== */}
      {findStopOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
            onClick={() => setFindStopOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass size={20} className="text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Find Bus Stop
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFindStopOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-4 pt-2 gap-2">
              <button
                type="button"
                onClick={() => setFindStopTab('name')}
                className={`pb-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  findStopTab === 'name'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Official Stops
              </button>

              <button
                type="button"
                onClick={() => setFindStopTab('landmark')}
                className={`pb-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  findStopTab === 'landmark'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                By Landmark
              </button>

              <button
                type="button"
                onClick={() => {
                  setFindStopTab('nearme')
                  if (nearMeStops.length === 0) handleFindStopsNearMe()
                }}
                className={`pb-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  findStopTab === 'nearme'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Stops Near Me
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {findStopTab === 'name' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search 9 official corridor stops..."
                    value={stopSearchQuery}
                    onChange={(e) => setStopSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-100 rounded-xl outline-hidden border border-slate-200"
                  />
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pt-1">
                    {allStops
                      .filter(
                        (s) =>
                          !stopSearchQuery ||
                          s.stop_name.toLowerCase().includes(stopSearchQuery.toLowerCase()) ||
                          s.stop_name_kn.includes(stopSearchQuery) ||
                          s.alternative_names.toLowerCase().includes(stopSearchQuery.toLowerCase())
                      )
                      .map((s) => (
                        <div
                          key={s.stop_id}
                          onClick={() => {
                            setCurrentStop(s.stop_name)
                            setFindStopOpen(false)
                          }}
                          className="p-2.5 rounded-xl border border-slate-100 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition-all"
                        >
                          <div>
                            <div className="text-xs font-extrabold text-slate-800">
                              {s.stop_name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {s.stop_name_kn} • {s.locality}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-blue-600">
                            Select →
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {findStopTab === 'landmark' && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Search landmarks (e.g. AJ Hospital, NITK, Sri Krishna Matha, Kaup Lighthouse) to find the nearest official stop.
                  </p>
                  <input
                    type="text"
                    placeholder="Enter landmark name..."
                    value={stopSearchQuery}
                    onChange={(e) => setStopSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-100 rounded-xl outline-hidden border border-slate-200"
                  />
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pt-1">
                    {allStops
                      .filter(
                        (s) =>
                          !stopSearchQuery ||
                          s.nearby_landmarks.toLowerCase().includes(stopSearchQuery.toLowerCase()) ||
                          s.stop_name.toLowerCase().includes(stopSearchQuery.toLowerCase())
                      )
                      .map((s) => (
                        <div
                          key={s.stop_id}
                          onClick={() => {
                            setCurrentStop(s.stop_name)
                            setFindStopOpen(false)
                          }}
                          className="p-2.5 rounded-xl border border-slate-100 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/50 cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-800">
                              {s.stop_name}
                            </span>
                            <span className="text-[10px] font-bold text-blue-600">
                              Set as Boarding →
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Landmarks: {s.nearby_landmarks}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {findStopTab === 'nearme' && (
                <div className="space-y-3">
                  <div className="bg-sky-50 rounded-2xl p-3 border border-sky-100 text-xs text-slate-600 space-y-1">
                    <p className="font-bold text-sky-900 flex items-center gap-1.5">
                      <Crosshair size={14} className="text-blue-600" />
                      <span>On-Demand Nearby Stops</span>
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Uses your GPS once to compute Haversine distances to official NH-66 corridor stops.
                    </p>
                  </div>

                  {nearMeLoading ? (
                    <div className="text-center py-6 text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
                      <RotateCw size={14} className="animate-spin text-blue-600" />
                      <span>Locating closest bus stops...</span>
                    </div>
                  ) : nearMeError ? (
                    <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
                      {nearMeError}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {nearMeStops.map((s) => (
                        <div
                          key={s.stop_id}
                          onClick={() => {
                            setCurrentStop(s.stop_name)
                            setFindStopOpen(false)
                          }}
                          className="p-3 rounded-xl border border-slate-100 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition-all"
                        >
                          <div>
                            <div className="text-xs font-extrabold text-slate-900">
                              {s.stop_name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {s.locality}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                              {s.distance_km} km away
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleFindStopsNearMe}
                    disabled={nearMeLoading}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCw size={13} className={nearMeLoading ? 'animate-spin' : ''} />
                    <span>Refresh My Location</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* HELPDESK & FAQ MODAL                                           */}
      {/* ============================================================== */}
      {activeModal === 'helpdesk' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle size={20} className="text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Helpdesk &amp; FAQs
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3 text-xs leading-relaxed text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-1">
                  How accurate is live bus tracking?
                </h4>
                <p>
                  Telemetry updates in real-time from onboard conductor GPS sessions along the Mangaluru–Kundapura NH-66 corridor.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-1">
                  Which corridor stops are supported?
                </h4>
                <p>
                  Strictly 9 official corridor stops: Mangaluru, Kuntikana, Kulur, Surathkal, Mulki, Padubidri, Kaup, Udupi, and Kundapura.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-1">
                  Do I need an account to track buses?
                </h4>
                <p>
                  No. Karavali-Transit is 100% free and open for all public transit passengers with zero login or registration required.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PASSENGER FEEDBACK MODAL                                       */}
      {/* ============================================================== */}
      {activeModal === 'feedback' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={20} className="text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Passenger Feedback
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitFeedback} className="p-4 flex-1 overflow-y-auto space-y-3">
              {feedbackSuccess ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
                  <h4 className="text-sm font-extrabold text-emerald-900">
                    Feedback Received!
                  </h4>
                  <p className="text-xs text-emerald-700">
                    Thank you for helping us improve coastal transit services along NH-66.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFeedbackSuccess(false)}
                    className="mt-2 text-xs font-bold text-blue-600 underline cursor-pointer"
                  >
                    Send another note
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Priya Rao"
                      value={feedbackName}
                      onChange={(e) => setFeedbackName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. priya@example.com"
                      value={feedbackEmail}
                      onChange={(e) => setFeedbackEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Rating (1 to 5 Stars)
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          className={`text-xl cursor-pointer ${
                            star <= feedbackRating ? 'text-amber-400' : 'text-slate-300'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Message / Observations
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Share your transit feedback or route timings observations..."
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={feedbackSubmitting}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CONTACT US MODAL                                               */}
      {/* ============================================================== */}
      {activeModal === 'contact' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone size={20} className="text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Contact Support
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="font-bold text-slate-900 block">
                  Project Inquiries
                </span>
                <p>Karavali-Transit Coastal Private Bus Tracking System</p>
                <p className="text-blue-600 font-semibold">support@karavali-transit.local</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="font-bold text-slate-900 block">
                  Coastal Corridor Route
                </span>
                <p>Mangaluru – Surathkal – Mulki – Udupi – Kundapura (NH-66)</p>
                <p className="text-slate-500">Karnataka, India</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
