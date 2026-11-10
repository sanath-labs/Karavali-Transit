import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Bus,
  ArrowLeft,
  Clock,
  MapPin,
  Flag,
  RotateCw,
  Compass,
  ArrowRight,
} from 'lucide-react'
import io from 'socket.io-client'
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { apiUrl, socketUrl } from './api.js'
import { OFFICIAL_9_CORRIDOR_STOPS } from './transitUtils.js'
import JourneySearchCard from './components/JourneySearchCard.jsx'
import PopularJourneys from './components/PopularJourneys.jsx'
import BusCard from './components/BusCard.jsx'
import RouteTimeline from './components/RouteTimeline.jsx'
import LiveTrackingHud from './components/LiveTrackingHud.jsx'
import { busLiveIcon, stopPinIcon } from './mapIcons.js'
import { MapViewportController } from './components/MapMarkers.jsx'

export default function PassengerPortal({
  preselectedStop,
  onOpenFindStop,
  initialScreen = 1,
  lang = 'en',
  liveBuses = {},
  socket: propSocket = null,
}) {
  // Page Navigation (1 = Search/Home, 2 = Results, 3 = Details, 4 = Live Tracking)
  const [screen, setScreen] = useState(initialScreen)

  useEffect(() => {
    if (initialScreen) {
      setScreen(initialScreen)
    }
  }, [initialScreen])

  // Search Fields (Default: Surathkal -> Udupi along the 9 corridor stops)
  const [currentStop, setCurrentStop] = useState('Surathkal')
  const [destination, setDestination] = useState('Udupi')
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false)
  const [toDropdownOpen, setToDropdownOpen] = useState(false)
  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')

  // Sync preselected stop if clicked from Route Strip
  useEffect(() => {
    if (preselectedStop) {
      const match = OFFICIAL_9_CORRIDOR_STOPS.find(
        (s) => s.stop_name.toLowerCase() === preselectedStop.toLowerCase()
      )
      if (match) {
        setCurrentStop(match.stop_name)
        if (match.stop_id >= 8) {
          setDestination('Kundapura')
        } else {
          const nextStop = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_id > match.stop_id)
          if (nextStop) setDestination(nextStop.stop_name)
        }
      }
    }
  }, [preselectedStop])

  // Bus List & Filters (Screen 2)
  const [buses, setBuses] = useState([])
  const [loadingBuses, setLoadingBuses] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'active' | 'scheduled'

  // Selected Bus Details (Screen 3 & Screen 4)
  const [selectedBus, setSelectedBus] = useState(null)
  const [routeDetails, setRouteDetails] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  // Real-time Telemetry & Seconds Elapsed Timer (Screen 4)
  const [secondsAgo, setSecondsAgo] = useState(15)
  const [liveTelemetry, setLiveTelemetry] = useState(liveBuses || {})
  const socketRef = useRef(null)

  // Sync liveTelemetry when liveBuses prop updates from App
  useEffect(() => {
    if (liveBuses && Object.keys(liveBuses).length > 0) {
      setLiveTelemetry((prev) => ({ ...prev, ...liveBuses }))
    }
  }, [liveBuses])

  // Popular Routes
  const POPULAR_ROUTES = [
    { from: 'Mangaluru', to: 'Udupi' },
    { from: 'Surathkal', to: 'Udupi' },
    { from: 'Mangaluru', to: 'Kundapura' },
    { from: 'Mulki', to: 'Udupi' },
  ]

  // Setup WebSocket Telemetry Connection
  useEffect(() => {
    const socket = propSocket || io(socketUrl)
    socketRef.current = socket

    socket.on('sync_buses', (synced) => {
      if (synced && typeof synced === 'object') {
        setLiveTelemetry((prev) => ({ ...prev, ...synced }))
      }
    })

    socket.on('shift_broadcast', (data) => {
      if (!data || !data.bus_id) return
      setLiveTelemetry((prev) => ({
        ...prev,
        [data.bus_id]: {
          ...(prev[data.bus_id] || {}),
          ...data,
          is_on_shift: true,
          tracking_status: data.tracking_status || 'NOT TRACKING',
          conductor_name: data.conductor_name || prev[data.bus_id]?.conductor_name,
        },
      }))
    })

    socket.on('live_location_broadcast', (data) => {
      if (!data || !data.bus_id) return
      setLiveTelemetry((prev) => ({
        ...prev,
        [data.bus_id]: {
          ...(prev[data.bus_id] || {}),
          ...data,
          is_on_shift: data.is_on_shift !== undefined ? data.is_on_shift : true,
          tracking_status: data.tracking_status || (data.latitude && data.longitude ? 'LIVE' : 'NOT TRACKING'),
          timestamp: data.timestamp || Date.now(),
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
          is_on_shift: data.is_on_shift !== undefined ? data.is_on_shift : true,
          tracking_status: data.tracking_status || (data.latitude && data.longitude ? 'LIVE' : 'NOT TRACKING'),
          timestamp: data.timestamp || Date.now(),
        },
      }))
      setSecondsAgo(0)
    })

    socket.on('bus_tracking_stopped', ({ bus_id }) => {
      if (!bus_id) return
      setLiveTelemetry((prev) => ({
        ...prev,
        [bus_id]: {
          ...(prev[bus_id] || {}),
          tracking_status: 'OFFLINE',
          is_on_shift: false,
        },
      }))
    })

    return () => {
      if (!propSocket) {
        socket.disconnect()
      }
    }
  }, [propSocket])

  // Initial Bus Search on Mount
  useEffect(() => {
    handleSearchBuses('Surathkal', 'Udupi', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter Dropdown Suggestions from 9 Official Corridor Stops
  const fromSuggestions = useMemo(() => {
    const q = fromQuery.trim().toLowerCase()
    return OFFICIAL_9_CORRIDOR_STOPS.filter(
      (s) =>
        s.stop_id < 9 && // Kundapura is northern terminus
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

  // Select From stop with automatic destination adjustment if needed
  const handleSelectFromStop = (stopName) => {
    setCurrentStop(stopName)
    const newFromObj = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_name === stopName)
    const currentToObj = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_name === destination)

    let nextTo = destination
    if (newFromObj && currentToObj && currentToObj.stop_id <= newFromObj.stop_id) {
      const nextStop = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_id > newFromObj.stop_id)
      nextTo = nextStop ? nextStop.stop_name : 'Kundapura'
      setDestination(nextTo)
    }
    handleSearchBuses(stopName, nextTo, false)
  }

  // Select Destination stop and refresh matching corridor buses
  const handleSelectToStop = (stopName) => {
    setDestination(stopName)
    handleSearchBuses(currentStop, stopName, false)
  }

  // Real Search Buses API handler
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
        const hasActive = data.buses.some(
          (b) =>
            b.is_live ||
            b.is_on_shift ||
            b.tracking_status === 'LIVE' ||
            b.tracking_status === 'LOCATION STALE' ||
            b.tracking_status === 'NOT TRACKING'
        )
        setActiveFilter(hasActive ? 'active' : 'all')
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

  // Swap From & To safely while preserving forward corridor alignment
  const handleSwapStops = () => {
    const fromObj = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_name === currentStop)
    const toObj = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_name === destination)
    const fromId = fromObj?.stop_id || 1
    const toId = toObj?.stop_id || 8

    let nextFrom = currentStop
    let nextTo = destination

    if (toId < 9) {
      nextFrom = destination
      const next = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_id > toId)
      nextTo = next ? next.stop_name : 'Kundapura'
    } else {
      const prev = OFFICIAL_9_CORRIDOR_STOPS.find((s) => s.stop_id < fromId)
      if (prev) {
        nextTo = currentStop
        nextFrom = prev.stop_name
      } else {
        nextFrom = 'Surathkal'
        nextTo = 'Udupi'
      }
    }

    setCurrentStop(nextFrom)
    setDestination(nextTo)
    handleSearchBuses(nextFrom, nextTo, false)
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

  // Combine static DB search results with live telemetry & active shifts
  const enrichedBuses = useMemo(() => {
    return buses.map((bus) => {
      const live = liveTelemetry[bus.bus_id]
      if (!live) return bus

      const hasCoords = Boolean(
        typeof live.latitude === 'number' &&
          typeof live.longitude === 'number' &&
          live.latitude >= 12.0 &&
          live.latitude <= 15.0 &&
          live.longitude >= 73.5 &&
          live.longitude <= 76.0
      )

      const isOnShift = Boolean(
        live.is_on_shift ||
          bus.is_on_shift ||
          live.tracking_status === 'LIVE' ||
          live.tracking_status === 'LOCATION STALE' ||
          live.tracking_status === 'NOT TRACKING'
      )

      const isLiveTracking = Boolean(
        live.tracking_status === 'LIVE' ||
          (hasCoords && isOnShift && live.tracking_status !== 'OFFLINE' && live.tracking_status !== 'LOCATION STALE')
      )

      const trackingStatus =
        live.tracking_status ||
        (isLiveTracking ? 'LIVE' : isOnShift ? 'NOT TRACKING' : bus.tracking_status || 'SCHEDULED')

      return {
        ...bus,
        ...live,
        conductor_name: live.conductor_name || bus.conductor_name,
        conductor_phone: live.conductor_phone || live.driver_phone || bus.conductor_phone,
        tracking_status: trackingStatus,
        is_live: isLiveTracking,
        is_on_shift: isOnShift,
        latitude: hasCoords ? live.latitude : bus.latitude,
        longitude: hasCoords ? live.longitude : bus.longitude,
        speed: live.speed !== undefined ? live.speed : bus.speed,
        timestamp: live.timestamp || bus.timestamp,
      }
    })
  }, [buses, liveTelemetry])

  const isBusActive = (b) => {
    return Boolean(
      b.is_live ||
        b.is_on_shift ||
        b.tracking_status === 'LIVE' ||
        b.tracking_status === 'LOCATION STALE' ||
        b.tracking_status === 'NOT TRACKING'
    )
  }

  // Filter counts for Screen 2
  const activeCount = useMemo(
    () => enrichedBuses.filter(isBusActive).length,
    [enrichedBuses]
  )

  const scheduledCount = useMemo(
    () => enrichedBuses.filter((b) => !isBusActive(b)).length,
    [enrichedBuses]
  )

  const displayedBuses = useMemo(() => {
    if (activeFilter === 'active') {
      const activeOnly = enrichedBuses.filter(isBusActive)
      return activeOnly.length > 0 ? activeOnly : enrichedBuses
    }
    if (activeFilter === 'scheduled') {
      return enrichedBuses.filter((b) => !isBusActive(b))
    }
    return enrichedBuses
  }, [enrichedBuses, activeFilter])

  // Real-time telemetry for the selected bus
  const activeSelectedBus = useMemo(() => {
    if (selectedBus) {
      const match = enrichedBuses.find((b) => b.bus_id === selectedBus.bus_id)
      return match || selectedBus
    }
    return enrichedBuses[0] || null
  }, [selectedBus, enrichedBuses])

  const trackedTelemetry = useMemo(() => {
    if (!activeSelectedBus) return null
    return liveTelemetry[activeSelectedBus.bus_id] || activeSelectedBus
  }, [activeSelectedBus, liveTelemetry])

  // Dynamic seconds ago counter based on actual hardware GPS timestamp
  useEffect(() => {
    const timer = setInterval(() => {
      const ts = trackedTelemetry?.timestamp
      if (ts) {
        const diff = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000))
        setSecondsAgo(diff)
      } else {
        setSecondsAgo(0)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [trackedTelemetry?.timestamp])

  const hasLiveCoordinates = useMemo(() => {
    const lat = trackedTelemetry?.latitude
    const lng = trackedTelemetry?.longitude
    return Boolean(
      typeof lat === 'number' &&
        typeof lng === 'number' &&
        lat >= 12.0 &&
        lat <= 15.0 &&
        lng >= 73.5 &&
        lng <= 76.0
    )
  }, [trackedTelemetry])

  const currentTrackingStatus = useMemo(() => {
    if (!activeSelectedBus) return 'OFFLINE'
    if (trackedTelemetry?.tracking_status) return trackedTelemetry.tracking_status
    if (hasLiveCoordinates) {
      const ts = trackedTelemetry?.timestamp ? new Date(trackedTelemetry.timestamp).getTime() : 0
      if (ts > 0 && Date.now() - ts >= 120000) return 'LOCATION STALE'
      return 'LIVE'
    }
    if (activeSelectedBus.is_on_shift) return 'NOT TRACKING'
    return 'OFFLINE'
  }, [activeSelectedBus, trackedTelemetry, hasLiveCoordinates])

  const busCoords = useMemo(() => {
    if (hasLiveCoordinates) {
      return [trackedTelemetry.latitude, trackedTelemetry.longitude]
    }
    // Default corridor center (Kaup / Padubidri) for map centering when bus has not yet transmitted GPS
    return [13.2208, 74.7431]
  }, [hasLiveCoordinates, trackedTelemetry])

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

  // ==========================================================================
  // PAGE 1: PASSENGER HOMEPAGE (CLEAN, ACCESSIBLE, RESPONSIVE LAYOUT)
  // ==========================================================================
  const renderHomepage = () => (
    <div className="w-full flex flex-col space-y-7 select-none">
      {/* 1. Main Journey Search Panel */}
      <JourneySearchCard
        currentStop={currentStop}
        destination={destination}
        fromDropdownOpen={fromDropdownOpen}
        setFromDropdownOpen={setFromDropdownOpen}
        toDropdownOpen={toDropdownOpen}
        setToDropdownOpen={setToDropdownOpen}
        fromQuery={fromQuery}
        setFromQuery={setFromQuery}
        toQuery={toQuery}
        setToQuery={setToQuery}
        fromSuggestions={fromSuggestions}
        toSuggestions={toSuggestions}
        onSelectFromStop={handleSelectFromStop}
        onSelectToStop={handleSelectToStop}
        onSwapStops={handleSwapStops}
        onSearchBuses={() => handleSearchBuses(currentStop, destination, true)}
        loadingBuses={loadingBuses}
        lang={lang}
      />

      {/* 2. Popular Journeys Shortcuts */}
      <PopularJourneys
        routes={POPULAR_ROUTES}
        onSelectJourney={(from, to) => handleSearchBuses(from, to)}
        lang={lang}
      />

      {/* 3. Compact "Find a Bus Stop" Helper Card */}
      <div
        onClick={() => onOpenFindStop && onOpenFindStop()}
        className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:border-blue-400 hover:shadow-xs flex items-center justify-between gap-4 cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label="Find nearest bus stop helper"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (onOpenFindStop) onOpenFindStop()
          }
        }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Compass size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 m-0">
              {lang === 'kn' ? 'ನಿಮ್ಮ ಸಮೀಪದ ಬಸ್ ನಿಲ್ದಾಣ ಹುಡುಕಿ' : 'Need help identifying your nearest bus stop?'}
            </h2>
            <p className="text-xs text-slate-600 font-medium m-0 mt-0.5">
              {lang === 'kn'
                ? 'ಎನ್ಐಟಿಕೆ, ಆಸ್ಪತ್ರೆಗಳು, ದೇವಸ್ಥಾನಗಳಂತಹ ಸ್ಥಳಗಳಿಂದ ಹುಡುಕಿ ಅಥವಾ ಜಿಪಿಎಸ್ ದೂರವನ್ನು ಬಳಸಿ.'
                : 'Search by familiar landmarks such as NITK, hospitals, temples, or use on-demand distance lookup.'}
            </p>
          </div>
        </div>
        <span className="text-xs font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-xl shrink-0 transition flex items-center gap-1">
          <span>{lang === 'kn' ? 'ನಿಲ್ದಾಣ ಹುಡುಕಿ' : 'Find a Stop'}</span>
          <ArrowRight size={13} strokeWidth={2.4} />
        </span>
      </div>

      {/* 4. Official Corridor Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider m-0">
            {lang === 'kn' ? 'ಅಧಿಕೃತ 9 ಹೆದ್ದಾರಿ ನಿಲ್ದಾಣಗಳು' : 'Official 9-Station Corridor Alignment'}
          </h3>
          <span className="text-[11px] font-semibold text-slate-500">
            NH-66 Coastal Highway
          </span>
        </div>
        <p className="text-xs text-slate-600 m-0 leading-relaxed">
          {lang === 'kn'
            ? 'ಎಲ್ಲಾ ಖಾಸಗಿ ಎಕ್ಸ್‌ಪ್ರೆಸ್ ಬಸ್‌ಗಳು ಈ 9 ಗೊತ್ತುಪಡಿಸಿದ ನಿಲ್ದಾಣಗಳ ಮೂಲಕ ನಿಯಮಿತವಾಗಿ ಸಂಚರಿಸುತ್ತವೆ:'
            : 'All private express and ordinary corridor services operate sequentially through these 9 designated stops:'}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-9 gap-2 pt-1 text-center">
          {OFFICIAL_9_CORRIDOR_STOPS.map((s) => (
            <button
              key={s.stop_id}
              type="button"
              onClick={() => {
                handleSelectFromStop(s.stop_name)
                handleSearchBuses(s.stop_name, destination)
              }}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition text-left sm:text-center active:scale-95 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <span className="block text-[10px] font-bold text-slate-500">Stop #{s.stop_id}</span>
              <strong className="block text-xs font-black text-slate-900 mt-0.5">{s.stop_name}</strong>
              <span className="block text-[10px] text-slate-500 font-semibold">{s.stop_name_kn}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // ==========================================================================
  // PAGE 2: MATCHING BUS RESULTS (RESPONSIVE FULL-WIDTH GRID)
  // ==========================================================================
  const renderBusesPage = () => (
    <div className="w-full flex flex-col space-y-6 select-none">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setScreen(1)}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer shadow-2xs active:scale-95"
            aria-label="Back to Journey Search"
            title="Back to Journey Search"
          >
            <ArrowLeft size={19} strokeWidth={2.4} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
              Buses: {currentStop} → {destination}
            </h1>
            <p className="text-xs font-semibold text-slate-600 m-0 mt-0.5">
              Select an active service to view timetable details or live tracking
            </p>
          </div>
        </div>

        {/* Filter Pills: Active, All, Scheduled */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'active'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Active ({activeCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            All ({buses.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('scheduled')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'scheduled'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>Scheduled ({scheduledCount})</span>
          </button>
        </div>
      </div>

      {/* Bus Cards List / Grid or Helpful Empty State */}
      {loadingBuses ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <RotateCw size={32} className="mx-auto text-blue-600 animate-spin" />
          <h3 className="text-base font-black text-slate-900 m-0">Searching Corridor Services...</h3>
          <p className="text-xs text-slate-500 font-medium m-0">Connecting to PostgreSQL transit network database</p>
        </div>
      ) : searchError ? (
        <div className="p-8 bg-white rounded-2xl border border-rose-200 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <MapPin size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-rose-900 m-0">Search Notice</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto m-0 leading-relaxed">{searchError}</p>
          </div>
          <button
            type="button"
            onClick={() => setScreen(1)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs transition"
          >
            Modify Boarding &amp; Destination
          </button>
        </div>
      ) : displayedBuses.length === 0 ? (
        <div className="text-center py-16 px-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Bus size={28} strokeWidth={2.2} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-slate-900 m-0">
              No buses found matching this journey
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto m-0 leading-relaxed">
              There are currently no active or scheduled buses between{' '}
              <strong className="text-slate-900">{currentStop}</strong> and{' '}
              <strong className="text-slate-900">{destination}</strong> in this filter view.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {activeFilter !== 'all' && buses.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black transition cursor-pointer"
              >
                Show All ({buses.length}) Buses
              </button>
            )}
            <button
              type="button"
              onClick={() => setScreen(1)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
            >
              ← Modify Boarding &amp; Destination
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedBuses.map((bus) => (
            <BusCard
              key={bus.bus_id}
              bus={bus}
              currentStop={currentStop}
              destination={destination}
              onTrack={handleTrackBusDirectly}
              onViewDetails={handleSelectBusDetails}
            />
          ))}
        </div>
      )}
    </div>
  )

  // ==========================================================================
  // PAGE 3: BUS DETAILS (RESPONSIVE 2-COLUMN TIMETABLE LAYOUT)
  // ==========================================================================
  const renderDetailsPage = () => (
    <div className="w-full flex flex-col space-y-6 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setScreen(2)}
          className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer shadow-2xs"
          aria-label="Back to Bus Results"
        >
          <ArrowLeft size={19} strokeWidth={2.4} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
            Bus Details &amp; Route Timeline
          </h1>
          <p className="text-xs font-semibold text-slate-600 m-0 mt-0.5">
            {activeSelectedBus?.bus_name} ({activeSelectedBus?.vehicle_number})
          </p>
        </div>
      </div>

      {activeSelectedBus && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Bus Summary & Departure/Arrival */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <Bus size={24} strokeWidth={2.4} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 m-0 leading-tight">
                      {activeSelectedBus.bus_name}
                    </h2>
                    <p className="text-xs font-semibold text-slate-600 m-0 mt-0.5">
                      {activeSelectedBus.vehicle_number} • {activeSelectedBus.service_type || 'Non AC Express'}
                    </p>
                  </div>
                </div>

                {activeSelectedBus.is_live ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active GPS
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Scheduled
                  </span>
                )}
              </div>

              {/* Conductor Contact Info */}
              {activeSelectedBus.conductor_name && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">
                    Assigned Conductor
                  </span>
                  <strong className="text-slate-900 font-black text-sm block mt-0.5">
                    {activeSelectedBus.conductor_name}
                  </strong>
                  <span className="text-slate-600 block mt-0.5 font-medium">
                    Phone: {activeSelectedBus.conductor_phone || '98451 00000'}
                  </span>
                </div>
              )}

              {/* Departure & Arrival Cards */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5">
                  <div className="flex items-center gap-1.5 text-blue-700 mb-1">
                    <Clock size={15} strokeWidth={2.4} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Boarding Time
                    </span>
                  </div>
                  <strong className="text-base font-black text-slate-900 block leading-tight">
                    {activeSelectedBus.boarding_planned_time || '10:40 AM'}
                  </strong>
                  <span className="text-xs font-bold text-slate-700">
                    {currentStop}
                  </span>
                </div>

                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5">
                  <div className="flex items-center gap-1.5 text-rose-700 mb-1">
                    <Flag size={15} strokeWidth={2.4} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Planned Arrival
                    </span>
                  </div>
                  <strong className="text-base font-black text-slate-900 block leading-tight">
                    {activeSelectedBus.destination_planned_time || '12:15 PM'}
                  </strong>
                  <span className="text-xs font-bold text-slate-700">
                    {destination}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleTrackBusDirectly(activeSelectedBus)}
                className="w-full min-h-[48px] py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <MapPin size={18} strokeWidth={2.4} />
                <span>Track This Bus on Live Map</span>
              </button>
            </div>
          </div>

          {/* Right Column: Route & Stop Timings Vertical Timeline */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider m-0">
                Official Corridor Stops &amp; Timings
              </h3>
              <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">
                Verified timetable along the official 9-stop corridor alignment
              </p>
            </div>

            {loadingRoute ? (
              <div className="text-center py-8 text-xs font-semibold text-slate-500">
                <RotateCw size={24} className="mx-auto text-blue-600 animate-spin mb-2" />
                Loading verified corridor timetable...
              </div>
            ) : (
              <RouteTimeline
                stops={corridorTimelineStops}
                currentStop={currentStop}
                destination={destination}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )

  // ==========================================================================
  // PAGE 4: LIVE TRACKING MAP (LARGE LEAFLET MAP & HUD)
  // ==========================================================================
  const renderTrackingPage = () => (
    <div className="w-full flex flex-col space-y-4 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setScreen(3)}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer shadow-2xs"
            aria-label="Back to Bus Details"
          >
            <ArrowLeft size={19} strokeWidth={2.4} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
              Live Bus Tracking
            </h1>
            <p className="text-xs font-semibold text-slate-600 m-0 mt-0.5">
              {activeSelectedBus?.bus_name} ({activeSelectedBus?.vehicle_number}) • Mangaluru ➔ Kundapura Corridor
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setScreen(2)}
          className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition cursor-pointer hidden sm:block shadow-2xs"
        >
          View Bus List
        </button>
      </div>

      {/* Large Responsive Map Container */}
      <div className="relative w-full h-[560px] sm:h-[640px] md:h-[700px] rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
        <MapContainer
          center={busCoords}
          zoom={11}
          zoomControl={true}
          className="w-full h-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* NH-66 Coastal Corridor Polyline */}
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
                    Stop #{stop.stop_id} • Locality: {stop.locality}
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Live Bus Marker (Strictly when actual GPS coordinates exist) */}
          {activeSelectedBus && hasLiveCoordinates && (
            <Marker position={[trackedTelemetry.latitude, trackedTelemetry.longitude]} icon={busLiveIcon}>
              <Popup>
                <div className="text-xs">
                  <strong>{activeSelectedBus.bus_name}</strong>
                  <br />
                  {activeSelectedBus.vehicle_number}
                  <br />
                  Speed: {trackedTelemetry.speed || 0} km/h
                  <br />
                  Status: {currentTrackingStatus}
                </div>
              </Popup>
            </Marker>
          )}

          <MapViewportController bounds={mapBounds} center={busCoords} />
        </MapContainer>

        {/* Informational overlay when conductor has not yet started GPS telemetry */}
        {!hasLiveCoordinates && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 text-white backdrop-blur-xs px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 pointer-events-none text-center">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span>Waiting for onboard conductor to start live GPS telemetry • Showing timetable schedule</span>
          </div>
        )}

        {/* Floating Bottom HUD Card */}
        <LiveTrackingHud
          bus={activeSelectedBus}
          telemetry={trackedTelemetry}
          status={currentTrackingStatus}
          secondsAgo={secondsAgo}
          journeyInfo={{ from: currentStop, to: destination }}
        />
      </div>
    </div>
  )

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {screen === 1 && renderHomepage()}
      {screen === 2 && renderBusesPage()}
      {screen === 3 && renderDetailsPage()}
      {screen === 4 && renderTrackingPage()}
    </div>
  )
}
