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
  Layers,
  Sparkles,
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

  // 5 Screens Workflow (Matching exact reference image media_1793720304519_38c33f68.jpg)
  // 1: Home (Plan Your Journey & Search)
  // 2: Buses (Surathkal -> Udupi Available Buses & Timings)
  // 3: Bus Details (Route & Stop Timings vertical timeline)
  // 4: Live Tracking (Leaflet Map & Floating HUD)
  // 5: Hamburger Menu Drawer
  const [screen, setScreen] = useState(1)

  // View Mode: 'interactive' (standard full interactive app) | 'studio' (exact 5 side-by-side phone mockups)
  const [viewMode, setViewMode] = useState('interactive')

  // Drawer & Modal Overlays
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [findStopOpen, setFindStopOpen] = useState(false)
  const [findStopTab, setFindStopTab] = useState('name') // 'name' | 'landmark' | 'nearme'
  const [activeModal, setActiveModal] = useState(null) // 'helpdesk' | 'feedback' | 'contact'

  // Search Fields (Default to Surathkal -> Udupi as depicted in Reference Image)
  const [currentStop, setCurrentStop] = useState('Surathkal')
  const [destination, setDestination] = useState('Udupi')
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false)
  const [toDropdownOpen, setToDropdownOpen] = useState(false)
  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')

  // Bus List & Filters (Screen 2)
  const [buses, setBuses] = useState([])
  const [loadingBuses, setLoadingBuses] = useState(false)
  const [activeFilter, setActiveFilter] = useState('active') // 'active' | 'all' | 'scheduled'

  // Selected Bus Details (Screen 3 & Screen 4)
  const [selectedBus, setSelectedBus] = useState(null)
  const [routeDetails, setRouteDetails] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  // Real-time Telemetry & Seconds Elapsed Timer (Screen 4)
  const [secondsAgo, setSecondsAgo] = useState(15)
  const [liveTelemetry, setLiveTelemetry] = useState({})
  const socketRef = useRef(null)

  // Verified Bus Stops Cache (for Dropdowns & Find Stop modal)
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

  // Popular Routes (Matches Reference Image Screen 1)
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

  // Fetch verified corridor stops on load
  useEffect(() => {
    async function loadStops() {
      try {
        const res = await fetch(`${apiUrl}/api/public/stops`)
        const data = await res.json()
        if (data.success && Array.isArray(data.stops) && data.stops.length > 0) {
          setAllStops(data.stops)
        } else {
          setAllStops(OFFICIAL_9_CORRIDOR_STOPS)
        }
      } catch {
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
    // Enforce that Destination must occur strictly after Boarding Stop in corridor order
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

  // Search Buses API handler
  const handleSearchBuses = async (fromVal = currentStop, toVal = destination, shouldSwitchScreen = true) => {
    if (!fromVal || !toVal) return

    setLoadingBuses(true)
    setCurrentStop(fromVal)
    setDestination(toVal)

    try {
      const res = await fetch(
        `${apiUrl}/api/public/buses/search?from=${encodeURIComponent(fromVal)}&to=${encodeURIComponent(toVal)}`
      )
      const data = await res.json()
      if (data.success && Array.isArray(data.buses) && data.buses.length > 0) {
        setBuses(data.buses)
        if (!selectedBus) {
          setSelectedBus(data.buses[0])
        }
      } else {
        // Fallback realistic corridor seed data matching reference image
        const fallbackBuses = [
          {
            bus_id: 1,
            bus_name: 'Shri Durga Travels',
            vehicle_number: 'KA 19 AB 1234',
            service_type: 'Non AC',
            origin: 'Mangaluru',
            destination: 'Kundapura',
            boarding_stop: fromVal,
            boarding_planned_time: '10:40 AM',
            destination_stop: toVal,
            destination_planned_time: '12:15 PM',
            is_live: true,
            tracking_status: 'LIVE',
            next_stop: 'Kaup',
            live_eta_minutes: 18,
            conductor_name: 'Manjunath Shetty',
            conductor_phone: '98451 12345',
            latitude: 13.165,
            longitude: 74.76,
          },
          {
            bus_id: 2,
            bus_name: 'Sri Lakshmi Travels',
            vehicle_number: 'KA 20 CD 5678',
            service_type: 'AC',
            origin: 'Mangaluru',
            destination: 'Kundapura',
            boarding_stop: fromVal,
            boarding_planned_time: '11:15 AM',
            destination_stop: toVal,
            destination_planned_time: '12:50 PM',
            is_live: true,
            tracking_status: 'LIVE',
            next_stop: 'Mulki',
            live_eta_minutes: 25,
            conductor_name: 'Santhosh Poojary',
            conductor_phone: '98452 23456',
            latitude: 13.045,
            longitude: 74.789,
          },
          {
            bus_id: 3,
            bus_name: 'Udupi Express',
            vehicle_number: 'KA 21 GH 3456',
            service_type: 'Non AC',
            origin: 'Mangaluru',
            destination: 'Kundapura',
            boarding_stop: fromVal,
            boarding_planned_time: '12:30 PM',
            destination_stop: toVal,
            destination_planned_time: '02:05 PM',
            is_live: false,
            tracking_status: 'SCHEDULED',
            next_stop: null,
            live_eta_minutes: null,
            conductor_name: 'Pradeep Kumar',
            conductor_phone: '98453 34567',
          },
        ]
        setBuses(fallbackBuses)
        if (!selectedBus) {
          setSelectedBus(fallbackBuses[0])
        }
      }
      if (shouldSwitchScreen) {
        setScreen(2)
      }
    } catch {
      setScreen(2)
    } finally {
      setLoadingBuses(false)
    }
  }

  // Swap From & To (with corridor validation check)
  const handleSwapStops = () => {
    const fromObj = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_name === currentStop)
    const toObj = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_name === destination)

    if (toObj && fromObj && toObj.stop_id < fromObj.stop_id) {
      setCurrentStop(destination)
      setDestination(currentStop)
    } else {
      // Pick next valid stop along corridor
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
      const res = await fetch(`${apiUrl}/api/public/buses/${bus.bus_id}/route`)
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

  // Filter counts for Screen 2
  const activeCount = useMemo(
    () => buses.filter((b) => b.is_live || b.tracking_status === 'LIVE').length,
    [buses]
  )
  const scheduledCount = useMemo(
    () => buses.filter((b) => b.tracking_status === 'SCHEDULED' || !b.is_live).length,
    [buses]
  )
  const displayedBuses = useMemo(() => {
    if (activeFilter === 'active') {
      return buses.filter((b) => b.is_live || b.tracking_status === 'LIVE')
    }
    if (activeFilter === 'scheduled') {
      return buses.filter((b) => b.tracking_status === 'SCHEDULED' || !b.is_live)
    }
    return buses
  }, [buses, activeFilter])

  // Real-time telemetry for the selected bus
  const activeSelectedBus = useMemo(() => {
    return (
      selectedBus ||
      buses[0] || {
        bus_id: 1,
        bus_name: 'Shri Durga Travels',
        vehicle_number: 'KA 19 AB 1234',
        service_type: 'Non AC',
        is_live: true,
        tracking_status: 'LIVE',
        next_stop: 'Kaup',
        live_eta_minutes: 18,
        boarding_planned_time: '10:40 AM',
        destination_planned_time: '12:15 PM',
      }
    )
  }, [selectedBus, buses])

  const trackedTelemetry = useMemo(() => {
    if (!activeSelectedBus) return null
    return liveTelemetry[activeSelectedBus.bus_id] || activeSelectedBus
  }, [activeSelectedBus, liveTelemetry])

  const busCoords = useMemo(() => {
    if (trackedTelemetry?.latitude && trackedTelemetry?.longitude) {
      return [trackedTelemetry.latitude, trackedTelemetry.longitude]
    }
    // Default live bus position near Padubidri / Kaup along NH-66
    return [13.165, 74.76]
  }, [trackedTelemetry])

  // Full corridor 9-stop timeline list for Screen 3
  const corridorTimelineStops = useMemo(() => {
    // Reference timings for Shri Durga Travels along the 9 corridor stops
    const timingMap = {
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

    if (routeDetails?.stops?.length === 9) {
      return routeDetails.stops
    }

    return OFFICIAL_9_CORRIDOR_STOPS.map((stop) => ({
      ...stop,
      planned_arrival: timingMap[stop.stop_name] || '11:00 AM',
    }))
  }, [routeDetails])

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

  // Geolocation for "Find Stops Near Me" (on-demand click only, strictly no tracking)
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
            `${apiUrl}/api/public/stops/nearby?lat=${latitude}&lng=${longitude}&radius=30`
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

  // ==========================================================================
  // RENDER HELPERS: Individual Phone Screens matching Reference Design
  // ==========================================================================

  // Screen 1: Home
  const renderScreen1 = () => (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto">
      {/* Phone Status Bar */}
      <div className="px-6 pt-2 pb-1 flex items-center justify-between text-[11px] font-bold text-slate-800 shrink-0">
        <span>10:24</span>
        <div className="flex items-center gap-1.5 text-slate-700">
          <span className="text-[10px]">📶</span>
          <span className="text-[10px]">📡</span>
          <span className="text-xs">🔋</span>
        </div>
      </div>

      {/* Screen 1 Header */}
      <header className="px-4 py-2 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={() => {
            setMenuOpen(true)
            setScreen(5)
          }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
          aria-label="Open Navigation Menu"
        >
          <Menu size={22} strokeWidth={2.4} />
        </button>

        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Bus size={16} strokeWidth={2.4} />
          </span>
          <span className="font-extrabold text-sm tracking-tight text-slate-900">
            Karavali-Transit
          </span>
        </div>

        <button
          type="button"
          onClick={() => setNotificationsOpen(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 relative active:scale-95 transition-all"
          aria-label="Notifications"
        >
          <Bell size={19} strokeWidth={2.2} />
          <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-1.5 right-1.5 border-2 border-white" />
        </button>
      </header>

      {/* Screen 1 Content */}
      <div className="p-4 flex-1 flex flex-col space-y-3.5">
        {/* Coastal Banner Card (Matching Reference Screen 1) */}
        <div className="relative rounded-2xl overflow-hidden shadow-sm border border-sky-200/60 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-900 text-white p-4 min-h-[96px] flex flex-col justify-between">
          <div className="absolute right-0 top-0 bottom-0 w-2/5 opacity-30 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-200 via-white to-transparent" />
          <div className="relative z-10">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-sky-200 block">
              Coastal Highway Corridor
            </span>
            <h2 className="text-sm sm:text-base font-black leading-tight mt-0.5">
              Track Your Bus Along The Coastal Route
            </h2>
            <p className="text-xs font-semibold text-sky-100 mt-0.5">
              Mangaluru – Kundapura
            </p>
          </div>
          <div className="relative z-10 flex items-center gap-1.5 text-[10px] font-bold text-sky-200 mt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>9 Official Corridor Stops Active</span>
          </div>
        </div>

        {/* Plan Your Journey Card */}
        <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-100 space-y-3 relative">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Bus size={15} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 leading-tight">
                Plan Your Journey
              </h3>
              <p className="text-[10px] font-medium text-slate-500">
                Select your boarding and destination
              </p>
            </div>
          </div>

          {/* Current Bus Stop (From) */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <MapPin size={12} className="text-emerald-500 shrink-0" />
                <span>From</span>
              </span>
            </div>

            <div
              onClick={() => {
                setFromDropdownOpen(true)
                setToDropdownOpen(false)
              }}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-500 cursor-pointer transition-all"
            >
              <span className="text-xs font-bold text-slate-800">
                {currentStop}
              </span>
              <ChevronDown size={16} className="text-slate-400" />
            </div>

            {fromDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 max-h-52 overflow-y-auto">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <input
                    type="text"
                    placeholder="Search corridor stop..."
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

          {/* Swap Button */}
          <div className="flex justify-end -my-1 pr-2">
            <button
              type="button"
              onClick={handleSwapStops}
              className="w-7 h-7 rounded-full border border-slate-200 bg-white shadow-xs flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-400 active:scale-95 transition-all cursor-pointer"
              title="Swap From and To"
            >
              <ArrowUpDown size={13} strokeWidth={2.4} />
            </button>
          </div>

          {/* Destination (To) */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <MapPin size={12} className="text-rose-500 shrink-0" />
                <span>To</span>
              </span>
            </div>

            <div
              onClick={() => {
                setToDropdownOpen(true)
                setFromDropdownOpen(false)
              }}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-500 cursor-pointer transition-all"
            >
              <span className="text-xs font-bold text-slate-800">
                {destination}
              </span>
              <ChevronDown size={16} className="text-slate-400" />
            </div>

            {toDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 max-h-52 overflow-y-auto">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <input
                    type="text"
                    placeholder="Search corridor destination..."
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

          {/* Search Buses Button (Screen 1 Blue CTA) */}
          <button
            type="button"
            onClick={() => handleSearchBuses()}
            disabled={loadingBuses}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-1 cursor-pointer"
          >
            <Search size={15} strokeWidth={2.5} />
            <span>{loadingBuses ? 'Searching...' : 'Search Buses'}</span>
          </button>
        </div>

        {/* Popular Journeys (Matches Reference Image Screen 1) */}
        <div>
          <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-2">
            Popular Journeys
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {POPULAR_ROUTES.map((route) => (
              <button
                key={`${route.from}-${route.to}`}
                type="button"
                onClick={() => handleSearchBuses(route.from, route.to)}
                className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:border-blue-500 hover:text-blue-600 active:bg-blue-50 text-center shadow-2xs transition-all cursor-pointer"
              >
                {route.from} → {route.to}
              </button>
            ))}
          </div>
        </div>

        {/* Don't know your bus stop? Card */}
        <div
          onClick={() => setFindStopOpen(true)}
          className="bg-white rounded-2xl p-3 shadow-2xs border border-slate-100 flex items-center gap-3 cursor-pointer hover:border-blue-400 hover:shadow-xs transition-all"
        >
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <MapPin size={16} strokeWidth={2.4} />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-800 leading-tight">
              Don't know your bus stop?
            </h5>
            <span className="text-[11px] font-extrabold text-blue-600 hover:underline">
              Find a Stop →
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Coastal Artwork */}
      <div className="mt-auto pointer-events-none relative w-full h-20 overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-t from-sky-100/90 via-sky-50/50 to-transparent" />
        <svg
          viewBox="0 0 500 150"
          preserveAspectRatio="none"
          className="absolute bottom-0 w-full h-14 text-sky-200/50 fill-current"
        >
          <path d="M0.00,49.98 C149.99,150.00 349.89,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
        </svg>
        <svg
          viewBox="0 0 500 150"
          preserveAspectRatio="none"
          className="absolute bottom-0 w-full h-9 text-blue-300/40 fill-current"
        >
          <path d="M0.00,49.98 C180.00,120.00 320.00,10.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
        </svg>
        <div className="absolute bottom-1.5 left-4 text-[9px] font-bold text-sky-900 tracking-wider">
          🌊 Karavali Coastal Highway Corridor
        </div>
      </div>
    </div>
  )

  // Screen 2: Available Buses (Surathkal -> Udupi)
  const renderScreen2 = () => (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto">
      {/* Phone Status Bar */}
      <div className="px-6 pt-2 pb-1 flex items-center justify-between text-[11px] font-bold text-slate-800 shrink-0">
        <span>10:24</span>
        <div className="flex items-center gap-1.5 text-slate-700">
          <span className="text-[10px]">📶</span>
          <span className="text-[10px]">📡</span>
          <span className="text-xs">🔋</span>
        </div>
      </div>

      {/* Screen 2 Header */}
      <header className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={() => setScreen(1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
          aria-label="Back to Search"
        >
          <ArrowLeft size={19} strokeWidth={2.4} />
        </button>
        <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
          Buses: {currentStop} → {destination}
        </h2>
      </header>

      {/* Filter Tabs: Active (2) | All (3) | Scheduled (1) */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveFilter('active')}
          className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeFilter === 'active'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Active ({activeCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all whitespace-nowrap cursor-pointer ${
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
          className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeFilter === 'scheduled'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Scheduled ({scheduledCount})</span>
        </button>
      </div>

      {/* Bus Cards List */}
      <div className="p-3.5 space-y-3 flex-1">
        {displayedBuses.map((bus) => {
          const isLive = Boolean(bus.is_live || bus.tracking_status === 'LIVE')
          return (
            <div
              key={bus.bus_id}
              className="bg-white rounded-2xl p-3.5 shadow-2xs border border-slate-100 hover:border-blue-300 transition-all space-y-2.5"
            >
              {/* Top Row: Icon, Bus Name, Status Badge, Reg/Type */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                    <Bus size={18} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                      {bus.bus_name}
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500">
                      {bus.vehicle_number} • {bus.service_type || 'Non AC'}
                    </p>
                  </div>
                </div>

                {/* Status Pill */}
                {isLive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                    Scheduled
                  </span>
                )}
              </div>

              {/* Time Row */}
              <div className="flex items-center justify-between px-1 py-0.5">
                <div>
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1">
                    <Clock size={11} className="text-slate-400" />
                    <span>{bus.boarding_planned_time || '10:40 AM'}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {bus.boarding_stop || currentStop}
                  </span>
                </div>

                <div className="text-slate-400 font-bold text-xs tracking-widest">
                  ➔
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-slate-900 flex items-center justify-end gap-1">
                    <Clock size={11} className="text-slate-400" />
                    <span>{bus.destination_planned_time || '12:15 PM'}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {bus.destination_stop || destination}
                  </span>
                </div>
              </div>

              {/* Button(s) matching Reference Image Screen 2 */}
              {isLive ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTrackBusDirectly(bus)}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold py-2 rounded-xl shadow-xs text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <MapPin size={13} strokeWidth={2.4} />
                    <span>Track Bus</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectBusDetails(bus)}
                    className="w-full bg-white border border-blue-600 hover:bg-blue-50 active:scale-98 text-blue-600 font-extrabold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <span>View Details</span>
                  </button>
                </div>
              ) : (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleSelectBusDetails(bus)}
                    className="w-full bg-white border border-blue-600 hover:bg-blue-50 active:scale-98 text-blue-600 font-extrabold py-2 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer"
                  >
                    View Details
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // Screen 3: Bus Details (Route & Stop Timings)
  const renderScreen3 = () => (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto">
      {/* Phone Status Bar */}
      <div className="px-6 pt-2 pb-1 flex items-center justify-between text-[11px] font-bold text-slate-800 shrink-0">
        <span>10:24</span>
        <div className="flex items-center gap-1.5 text-slate-700">
          <span className="text-[10px]">📶</span>
          <span className="text-[10px]">📡</span>
          <span className="text-xs">🔋</span>
        </div>
      </div>

      {/* Screen 3 Header */}
      <header className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={() => setScreen(2)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
          aria-label="Back to Bus List"
        >
          <ArrowLeft size={19} strokeWidth={2.4} />
        </button>
        <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
          Bus Details
        </h2>
      </header>

      <div className="p-3.5 space-y-3.5 flex-1">
        {/* Top Summary Card */}
        <div className="bg-white rounded-2xl p-3.5 shadow-2xs border border-slate-100 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-blue-700 shrink-0">
                <Bus size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                  {activeSelectedBus.bus_name}
                </h3>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                  {activeSelectedBus.vehicle_number} • {activeSelectedBus.service_type || 'Non AC'}
                </p>
                {activeSelectedBus.conductor_name && (
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                    Conductor: {activeSelectedBus.conductor_name} ({activeSelectedBus.conductor_phone || 'Assigned'})
                  </p>
                )}
              </div>
            </div>

            {activeSelectedBus.is_live ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                Scheduled
              </span>
            )}
          </div>

          {/* Departure & Arrival Boxes Side-by-Side */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {/* Departure */}
            <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-2.5 flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-sky-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Clock size={13} strokeWidth={2.4} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Departure
                </span>
                <span className="text-xs font-black text-slate-900 block leading-tight">
                  {activeSelectedBus.boarding_planned_time || '10:40 AM'}
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  ({currentStop})
                </span>
              </div>
            </div>

            {/* Arrival (Planned) */}
            <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-2.5 flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                <Flag size={12} strokeWidth={2.4} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Arrival (Planned)
                </span>
                <span className="text-xs font-black text-slate-900 block leading-tight">
                  {activeSelectedBus.destination_planned_time || '12:15 PM'}
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  ({destination})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Route & Stop Timings Vertical Timeline (All 9 Stops in Order) */}
        <div className="bg-white rounded-2xl p-3.5 shadow-2xs border border-slate-100">
          <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider mb-3">
            Route &amp; Stop Timings
          </h4>

          {loadingRoute ? (
            <div className="text-center py-6 text-xs font-semibold text-slate-400">
              Loading verified corridor timeline...
            </div>
          ) : (
            <div className="space-y-0 relative pl-1.5">
              {corridorTimelineStops.map((stop, idx) => {
                const isLast = idx === corridorTimelineStops.length - 1
                const isBoarding = stop.stop_name.toLowerCase() === currentStop.toLowerCase()
                const isDestination = stop.stop_name.toLowerCase() === destination.toLowerCase()

                return (
                  <div key={stop.stop_id || idx} className="flex items-start gap-3 relative pb-4 last:pb-0">
                    {/* Connecting Vertical Line */}
                    {!isLast && (
                      <div className="absolute left-[7px] top-[14px] bottom-0 w-0.5 bg-slate-200" />
                    )}

                    {/* Timeline Node */}
                    {isBoarding ? (
                      <div className="w-4 h-4 rounded-full border-[3px] border-emerald-500 bg-white shrink-0 mt-0.5 z-10 shadow-xs" />
                    ) : isDestination ? (
                      <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 mt-0.5 z-10 shadow-xs">
                        <MapPin size={9} strokeWidth={3} />
                      </div>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 bg-white shrink-0 mt-0.5 ml-[1px] z-10" />
                    )}

                    {/* Stop Details */}
                    <div className="flex-1 -mt-0.5 flex items-center justify-between">
                      <div>
                        <div
                          className={`text-xs ${
                            isBoarding
                              ? 'font-black text-emerald-700'
                              : isDestination
                              ? 'font-black text-rose-700'
                              : 'font-bold text-slate-800'
                          }`}
                        >
                          {stop.stop_name}
                          {isBoarding && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded-sm text-[9px] font-black bg-emerald-100 text-emerald-800">
                              (Boarding)
                            </span>
                          )}
                          {isDestination && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded-sm text-[9px] font-black bg-rose-100 text-rose-800">
                              (Destination)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] font-bold text-slate-500">
                        {stop.planned_arrival}
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
      <div className="p-3 bg-white border-t border-slate-100 sticky bottom-0">
        <button
          type="button"
          onClick={() => handleTrackBusDirectly(activeSelectedBus)}
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-xs py-2.5 rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <MapPin size={15} strokeWidth={2.4} />
          <span>Track This Bus</span>
        </button>
      </div>
    </div>
  )

  // Screen 4: Live Tracking (Leaflet Map + Floating HUD)
  const renderScreen4 = () => (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Phone Status Bar */}
      <div className="px-6 pt-2 pb-1 flex items-center justify-between text-[11px] font-bold text-slate-800 shrink-0 bg-white z-10">
        <span>10:24</span>
        <div className="flex items-center gap-1.5 text-slate-700">
          <span className="text-[10px]">📶</span>
          <span className="text-[10px]">📡</span>
          <span className="text-xs">🔋</span>
        </div>
      </div>

      {/* Screen 4 Header */}
      <header className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0 shadow-2xs z-10">
        <button
          type="button"
          onClick={() => setScreen(3)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
          aria-label="Back to Details"
        >
          <ArrowLeft size={19} strokeWidth={2.4} />
        </button>
        <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
          Live Tracking
        </h2>
      </header>

      {/* Interactive Map Area */}
      <div className="flex-1 relative w-full h-full">
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
            const isDestination = stop.stop_name.toLowerCase() === destination.toLowerCase() || stop.stop_name === 'Kundapura'
            const isBoarding = stop.stop_name.toLowerCase() === currentStop.toLowerCase() || stop.stop_name === 'Mangaluru'

            return (
              <Marker
                key={`stop-${stop.stop_id}`}
                position={[stop.latitude, stop.longitude]}
                icon={stopPinIcon(stop.stop_name, isDestination, isBoarding)}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>{stop.stop_name} ({stop.stop_name_kn})</strong>
                    <br />
                    Locality: {stop.locality}
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Live Bus Marker */}
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

          <MapViewportController bounds={mapBounds} center={busCoords} />
        </MapContainer>

        {/* Floating Bottom HUD Card (Screen 4) */}
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <div className="bg-white rounded-2xl p-3.5 shadow-xl border border-slate-100 space-y-2.5">
            {/* Bus Info & Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                  <Bus size={18} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                    {activeSelectedBus.bus_name}
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-500">
                    {activeSelectedBus.vehicle_number}
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            </div>

            {/* Next Stop & ETA Boxes */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin size={10} className="text-rose-500 shrink-0" />
                  <span>Next Stop</span>
                </div>
                <div className="text-xs font-black text-slate-900 mt-0.5">
                  {trackedTelemetry?.next_stop || 'Kaup'}
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={10} className="text-blue-500 shrink-0" />
                  <span>ETA</span>
                </div>
                <div className="text-xs font-black text-slate-900 mt-0.5">
                  ~ {trackedTelemetry?.eta_minutes || 18} min
                </div>
              </div>
            </div>

            {/* Telemetry Freshness Bar */}
            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold text-slate-500">
              <div className="flex items-center gap-1.5">
                <RotateCw size={11} className="text-blue-600 animate-spin" />
                <span>
                  Last Updated: 11:02 AM • 🟢 Live ({secondsAgo}s)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Screen 5: Hamburger Slide-Out Drawer Menu (Matching Reference Screen 5)
  const renderScreen5 = () => (
    <div className="flex-1 flex flex-col bg-slate-900 text-white relative overflow-y-auto">
      {/* Phone Status Bar */}
      <div className="px-6 pt-2 pb-1 flex items-center justify-between text-[11px] font-bold text-slate-300 shrink-0 bg-blue-700">
        <span>10:24</span>
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="text-[10px]">📶</span>
          <span className="text-[10px]">📡</span>
          <span className="text-xs">🔋</span>
        </div>
      </div>

      {/* Top Banner (Matches Reference Image Screen 5) */}
      <div className="p-4 bg-gradient-to-br from-blue-700 to-indigo-900 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
            <Bus size={18} strokeWidth={2.4} />
          </span>
          <div>
            <h2 className="font-extrabold text-sm leading-tight text-white">
              Karavali-Transit
            </h2>
            <p className="text-[10px] text-sky-200 font-semibold">
              Passenger Portal
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false)
            setScreen(1)
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="p-3.5 space-y-1.5 flex-1 bg-slate-900">
        <button
          type="button"
          onClick={() => {
            setScreen(1)
            setMenuOpen(false)
          }}
          className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold bg-blue-600 text-white flex items-center gap-3 transition-all cursor-pointer shadow-xs"
        >
          <Navigation size={16} className="text-white" />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMenuOpen(false)
            handleSearchBuses('Surathkal', 'Udupi')
          }}
          className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-all cursor-pointer"
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

      {/* Language Switcher Pills at Bottom (Matching Reference Screen 5) */}
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
  )

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col text-slate-900 select-none">
      {/* ============================================================== */}
      {/* TOP ROUTE STEPPER BANNER (Depicted at top of Reference Graphic) */}
      {/* ============================================================== */}
      <header className="bg-white border-b border-slate-200 py-3 px-4 shadow-xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Title & Subtitles */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Bus size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-blue-950">
                  Karavali-Transit
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                  VTU Engineering Mini Project
                </span>
              </div>
              <p className="text-xs font-extrabold text-blue-700">
                Mangaluru – Kundapura Bus Tracking
              </p>
              <p className="text-[10px] font-semibold text-slate-500">
                Real-time • Reliable • Simple
              </p>
            </div>
          </div>

          {/* View Mode Switcher on Desktop */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('studio')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'studio'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Layers size={14} />
              <span className="hidden sm:inline">5-Screen Reference Studio</span>
              <span className="sm:hidden">5 Screens</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('interactive')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'interactive'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles size={14} />
              <span>Interactive App</span>
            </button>
          </div>
        </div>

        {/* 9-Stop Connecting Corridor Route Stepper */}
        <div className="max-w-7xl mx-auto mt-2.5 pt-2 border-t border-slate-100 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-[760px] py-1 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-extrabold text-[10px] flex items-center gap-1 shrink-0">
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

            <span className="text-base shrink-0 ml-1">🚍</span>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN CONTAINER: STUDIO VIEW (5 SCREENS) vs INTERACTIVE VIEW    */}
      {/* ============================================================== */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 overflow-x-auto">
        {viewMode === 'studio' ? (
          /* ============================================================ */
          /* 5-SCREEN STUDIO VIEW: EXACTLY MATCHING REFERENCE IMAGE       */
          /* ============================================================ */
          <div className="w-full max-w-[1500px] flex flex-col items-center">
            {/* Step Guides above the 5 phones */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full mb-4 px-2 text-center text-xs font-black text-slate-800">
              <div className="flex items-center justify-center gap-1.5 bg-white p-2 rounded-xl shadow-2xs border border-slate-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Select Stop &amp; Destination</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 bg-white p-2 rounded-xl shadow-2xs border border-slate-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                <span>Available Buses &amp; Timings</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 bg-white p-2 rounded-xl shadow-2xs border border-slate-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                <span>See Bus &amp; Route Details</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 bg-white p-2 rounded-xl shadow-2xs border border-slate-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">4</span>
                <span>Track Selected Bus Live</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 bg-white p-2 rounded-xl shadow-2xs border border-slate-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">5</span>
                <span>Navigation &amp; Drawer</span>
              </div>
            </div>

            {/* 5 Phone Screens Row */}
            <div className="flex items-start justify-center gap-5 w-full overflow-x-auto pb-4">
              {/* Phone 1: Home */}
              <div className="w-[280px] sm:w-[295px] h-[640px] bg-white rounded-[32px] shadow-2xl border-[6px] border-slate-800 overflow-hidden flex flex-col shrink-0">
                {renderScreen1()}
              </div>

              {/* Phone 2: Buses */}
              <div className="w-[280px] sm:w-[295px] h-[640px] bg-white rounded-[32px] shadow-2xl border-[6px] border-slate-800 overflow-hidden flex flex-col shrink-0">
                {renderScreen2()}
              </div>

              {/* Phone 3: Bus Details */}
              <div className="w-[280px] sm:w-[295px] h-[640px] bg-white rounded-[32px] shadow-2xl border-[6px] border-slate-800 overflow-hidden flex flex-col shrink-0">
                {renderScreen3()}
              </div>

              {/* Phone 4: Live Tracking */}
              <div className="w-[280px] sm:w-[295px] h-[640px] bg-white rounded-[32px] shadow-2xl border-[6px] border-slate-800 overflow-hidden flex flex-col shrink-0">
                {renderScreen4()}
              </div>

              {/* Phone 5: Hamburger Drawer */}
              <div className="w-[280px] sm:w-[295px] h-[640px] bg-slate-900 rounded-[32px] shadow-2xl border-[6px] border-slate-800 overflow-hidden flex flex-col shrink-0">
                {renderScreen5()}
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* INTERACTIVE APP VIEW: FOCUSED PHONE FRAME                    */
          /* ============================================================ */
          <div className="flex flex-col items-center w-full">
            {/* Screen Tab Switcher */}
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setScreen(1)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  screen === 1 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                1. Home
              </button>
              <button
                type="button"
                onClick={() => setScreen(2)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  screen === 2 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                2. Buses
              </button>
              <button
                type="button"
                onClick={() => setScreen(3)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  screen === 3 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                3. Bus Details
              </button>
              <button
                type="button"
                onClick={() => setScreen(4)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  screen === 4 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                4. Live Tracking
              </button>
              <button
                type="button"
                onClick={() => setScreen(5)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  screen === 5 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                5. Menu Drawer
              </button>
            </div>

            {/* Interactive Phone Mockup */}
            <div className="w-full max-w-[440px] h-[780px] bg-white sm:rounded-[36px] sm:shadow-2xl sm:border-[8px] sm:border-slate-800 overflow-hidden flex flex-col relative">
              {screen === 1 && renderScreen1()}
              {screen === 2 && renderScreen2()}
              {screen === 3 && renderScreen3()}
              {screen === 4 && renderScreen4()}
              {screen === 5 && renderScreen5()}

              {/* Slide-out Menu Drawer Overlay */}
              {menuOpen && screen !== 5 && (
                <div className="absolute inset-0 z-40 flex">
                  <div
                    className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity cursor-pointer"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="relative w-72 max-w-[85%] h-full shadow-2xl flex flex-col z-10">
                    {renderScreen5()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BOTTOM FEATURE CARDS (depicted at bottom of Reference Image)  */}
        {/* ============================================================== */}
        <section className="w-full max-w-5xl mt-8 pt-6 border-t border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
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

      {/* ============================================================== */}
      {/* NOTIFICATIONS DRAWER                                           */}
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
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
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
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
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
                  Telemetry updates in real-time from onboard conductor GPS sessions on the Mangaluru–Kundapura NH-66 corridor.
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
                  No. Karavali-Transit is 100% free and open for all public transit passengers with zero login or signup required.
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
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
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
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
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
