import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Bus,
  ArrowLeft,
  Clock,
  MapPin,
  Flag,
  RotateCw,
  Compass,
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
import { busLiveIcon, stopPinIcon, MapViewportController } from './components/MapMarkers.jsx'

export default function PassengerPortal({
  preselectedStop,
  onOpenFindStop,
  initialScreen = 1,
}) {
  // Page Navigation (1 = Search/Home, 2 = Results, 3 = Details, 4 = Live Tracking)
  const [screen, setScreen] = useState(initialScreen)

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
  const [activeFilter, setActiveFilter] = useState('active') // 'active' | 'all' | 'scheduled'

  // Selected Bus Details (Screen 3 & Screen 4)
  const [selectedBus, setSelectedBus] = useState(null)
  const [routeDetails, setRouteDetails] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  // Real-time Telemetry & Seconds Elapsed Timer (Screen 4)
  const [secondsAgo, setSecondsAgo] = useState(15)
  const [liveTelemetry, setLiveTelemetry] = useState({})
  const socketRef = useRef(null)

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

  // ==========================================================================
  // PAGE 1: PASSENGER HOMEPAGE (RESPONSIVE FULL-WIDTH DESKTOP LAYOUT)
  // ==========================================================================
  const renderHomepage = () => (
    <div className="w-full flex flex-col space-y-8 select-none">
      {/* Page Title & Corridor Scope */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight m-0">
          Find and Track Buses
        </h1>
        <p className="text-sm font-semibold text-slate-600 m-0">
          Real-time passenger information on the Mangaluru – Kundapura NH-66 coastal highway corridor
        </p>
      </div>

      {/* Main Journey Search Panel */}
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
        onSelectFromStop={(stop) => setCurrentStop(stop)}
        onSelectToStop={(stop) => setDestination(stop)}
        onSwapStops={handleSwapStops}
        onSearchBuses={() => handleSearchBuses()}
        loadingBuses={loadingBuses}
      />

      {/* Popular Journeys */}
      <PopularJourneys
        routes={POPULAR_ROUTES}
        onSelectJourney={(from, to) => handleSearchBuses(from, to)}
      />

      {/* Bus Stop Discovery Helper Banner */}
      <div
        onClick={() => onOpenFindStop && onOpenFindStop()}
        className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-4 cursor-pointer hover:border-blue-400 transition"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Compass size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 m-0">
              Need help identifying your nearest bus stop?
            </h3>
            <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">
              Search by familiar landmarks such as NITK, hospitals, temples, or use on-demand distance lookup.
            </p>
          </div>
        </div>
        <span className="text-xs font-extrabold text-blue-600 hover:underline shrink-0 hidden sm:inline-block">
          Find a Stop →
        </span>
      </div>

      {/* Official Corridor Overview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider m-0">
          Official Route Corridor Sequence
        </h3>
        <p className="text-xs text-slate-500 m-0">
          Private express and ordinary services operate on a single highway alignment serving these 9 designated stations:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-9 gap-2 pt-1 text-center">
          {OFFICIAL_9_CORRIDOR_STOPS.map((s) => (
            <div
              key={s.stop_id}
              onClick={() => {
                setCurrentStop(s.stop_name)
                handleSearchBuses(s.stop_name, destination)
              }}
              className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition text-left sm:text-center"
            >
              <span className="block text-[10px] font-bold text-slate-400">Stop #{s.stop_id}</span>
              <strong className="block text-xs font-black text-slate-900">{s.stop_name}</strong>
              <span className="block text-[10px] text-slate-500">{s.stop_name_kn}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ==========================================================================
  // PAGE 2: MATCHING BUS RESULTS (RESPONSIVE FULL-WIDTH DESKTOP GRID)
  // ==========================================================================
  const renderBusesPage = () => (
    <div className="w-full flex flex-col space-y-6 select-none">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setScreen(1)}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer"
            aria-label="Back to Journey Search"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 m-0">
              Buses: {currentStop} → {destination}
            </h1>
            <p className="text-xs font-semibold text-slate-500 m-0 mt-0.5">
              Select an active service to view route timeline or track in real-time
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
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
            className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
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
            className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'scheduled'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>Scheduled ({scheduledCount})</span>
          </button>
        </div>
      </div>

      {/* Bus Cards List / Grid */}
      {loadingBuses ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RotateCw size={32} className="mx-auto text-blue-600 animate-spin mb-3" />
          <h3 className="text-sm font-extrabold text-slate-900 m-0">Searching Corridor Services...</h3>
          <p className="text-xs text-slate-500 mt-1">Connecting to live PostgreSQL tracking session</p>
        </div>
      ) : searchError ? (
        <div className="p-6 bg-white rounded-2xl border border-rose-200 shadow-xs text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <MapPin size={24} />
          </div>
          <h3 className="text-sm font-extrabold text-rose-900 m-0">Search Notice</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto m-0">{searchError}</p>
          <button
            type="button"
            onClick={() => setScreen(1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Modify Boarding &amp; Destination
          </button>
        </div>
      ) : displayedBuses.length === 0 ? (
        <div className="text-center py-16 px-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Bus size={24} />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900 m-0">
            No matching buses in this filter
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto m-0">
            Try switching to &quot;All ({buses.length})&quot; or selecting another stop pair along the NH-66 corridor.
          </p>
          <button
            type="button"
            onClick={() => setScreen(1)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            ← Modify Journey
          </button>
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
  // PAGE 3: BUS DETAILS (RESPONSIVE 2-COLUMN DESKTOP LAYOUT)
  // ==========================================================================
  const renderDetailsPage = () => (
    <div className="w-full flex flex-col space-y-6 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setScreen(2)}
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer"
          aria-label="Back to Bus Results"
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 m-0">
            Bus Details &amp; Route Timeline
          </h1>
          <p className="text-xs font-semibold text-slate-500 m-0 mt-0.5">
            {activeSelectedBus?.bus_name} ({activeSelectedBus?.vehicle_number})
          </p>
        </div>
      </div>

      {activeSelectedBus && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Bus Summary & Departure/Arrival */}
          <div className="space-y-4">
            {/* Overview Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <Bus size={24} strokeWidth={2.4} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 m-0 leading-tight">
                      {activeSelectedBus.bus_name}
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 m-0 mt-0.5">
                      {activeSelectedBus.vehicle_number} • {activeSelectedBus.service_type || 'Non AC'}
                    </p>
                  </div>
                </div>

                {activeSelectedBus.is_live ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
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
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">
                    Assigned Conductor
                  </span>
                  <strong className="text-slate-900 font-extrabold">
                    {activeSelectedBus.conductor_name}
                  </strong>
                  <span className="text-slate-600 block mt-0.5 font-medium">
                    Phone: {activeSelectedBus.conductor_phone || '98451 00000'}
                  </span>
                </div>
              )}

              {/* Departure & Arrival Cards */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3.5">
                  <div className="flex items-center gap-1.5 text-blue-700 mb-1">
                    <Clock size={15} strokeWidth={2.4} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Departure
                    </span>
                  </div>
                  <strong className="text-base font-black text-slate-900 block leading-tight">
                    {activeSelectedBus.boarding_planned_time || '10:40 AM'}
                  </strong>
                  <span className="text-xs font-semibold text-slate-600">
                    {currentStop}
                  </span>
                </div>

                <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3.5">
                  <div className="flex items-center gap-1.5 text-rose-700 mb-1">
                    <Flag size={15} strokeWidth={2.4} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Arrival (Planned)
                    </span>
                  </div>
                  <strong className="text-base font-black text-slate-900 block leading-tight">
                    {activeSelectedBus.destination_planned_time || '12:15 PM'}
                  </strong>
                  <span className="text-xs font-semibold text-slate-600">
                    {destination}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleTrackBusDirectly(activeSelectedBus)}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <MapPin size={17} strokeWidth={2.4} />
                <span>Track This Bus on Live Map</span>
              </button>
            </div>
          </div>

          {/* Right Column: Route & Stop Timings Vertical Timeline */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider m-0">
                Route &amp; Stop Timings
              </h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Verified timetable along the official 9-stop corridor alignment
              </p>
            </div>

            {loadingRoute ? (
              <div className="text-center py-8 text-xs font-semibold text-slate-400">
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
  // PAGE 4: LIVE TRACKING MAP (RESPONSIVE FULL-WIDTH DESKTOP LAYOUT)
  // ==========================================================================
  const renderTrackingPage = () => (
    <div className="w-full flex flex-col space-y-4 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setScreen(3)}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer"
            aria-label="Back to Bus Details"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 m-0">
              Live Bus Tracking
            </h1>
            <p className="text-xs font-semibold text-slate-500 m-0 mt-0.5">
              {activeSelectedBus?.bus_name} ({activeSelectedBus?.vehicle_number}) • Mangaluru ➔ Kundapura Corridor
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setScreen(2)}
          className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer hidden sm:block"
        >
          View Bus List
        </button>
      </div>

      {/* Responsive Map Container */}
      <div className="relative w-full h-[520px] sm:h-[600px] rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
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
        <LiveTrackingHud
          bus={activeSelectedBus}
          telemetry={trackedTelemetry}
          secondsAgo={secondsAgo}
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
