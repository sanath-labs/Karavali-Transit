import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const corridorStops = [
  { name: 'Statebank (Terminal)', coords: [12.8718, 74.8430] },
  { name: 'Hampankatta', coords: [12.8850, 74.8450] },
  { name: 'Lalbagh', coords: [12.8970, 74.8480] },
  { name: 'Nanthoor Jn', coords: [12.8997, 74.8530] },
  { name: 'Kuloor Bridge', coords: [12.9271, 74.8415] },
  { name: 'Baikampady Industrial', coords: [12.9350, 74.8210] },
  { name: 'Surathkal (Terminus)', coords: [12.9472, 74.7963] },
]

const defaultRouteCoordinates = corridorStops.map((stop) => stop.coords)

// Calculate geographic bearing (heading angle in degrees 0-360)
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const toDeg = (rad) => (rad * 180) / Math.PI
  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const deltaLambda = toRad(lon2 - lon1)

  const y = Math.sin(deltaLambda) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)
  const theta = Math.atan2(y, x)
  return (toDeg(theta) + 360) % 360
}

// Smoothly frame both Passenger & Tracked Bus in view (Zomato/Uber style)
function MapTrackingFocuser({ passengerCoords, busCoords }) {
  const map = useMap()
  useEffect(() => {
    if (passengerCoords && busCoords && busCoords[0] && busCoords[1]) {
      const bounds = L.latLngBounds([passengerCoords, busCoords])
      map.fitBounds(bounds, {
        padding: [80, 80],
        maxZoom: 15,
        animate: true,
      })
    }
  }, [passengerCoords, busCoords, map])
  return null
}

function MapRecenter({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2 && center[0] && center[1]) {
      map.setView(center, 14, { animate: true })
    }
  }, [center, map])
  return null
}

// Interactive Map Camera Control Overlay (Center Bus, Center Me, Fit Both, Fullscreen)
function MapCameraControlOverlay({ passengerCoords, busCoords, isFullscreen, onToggleFullscreen }) {
  const map = useMap()

  const handleCenterPassenger = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (passengerCoords && passengerCoords[0]) {
      map.flyTo(passengerCoords, 16, { duration: 1.2 })
    }
  }

  const handleCenterBus = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (busCoords && busCoords[0]) {
      map.flyTo(busCoords, 16, { duration: 1.2 })
    }
  }

  const handleFitBoth = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (passengerCoords && busCoords && busCoords[0]) {
      const bounds = L.latLngBounds([passengerCoords, busCoords])
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15, animate: true })
    } else if (passengerCoords) {
      map.flyTo(passengerCoords, 14, { duration: 1.2 })
    }
  }

  return (
    <div className="leaflet-top leaflet-right !top-3 !right-3 z-[1000] pointer-events-auto">
      <div className="flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/90 shadow-xl">
        <button
          type="button"
          onClick={handleFitBoth}
          title="Fit Both: Overview of Bus and Boarding Stop"
          className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border border-slate-200/60"
        >
          <span className="text-sm">🔍</span>
          <span className="hidden sm:inline font-extrabold text-[11px]">Fit Both</span>
        </button>
        {busCoords && (
          <button
            type="button"
            onClick={handleCenterBus}
            title="Focus & Follow Incoming Bus"
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border border-slate-200/60"
          >
            <span className="text-sm">🚍</span>
            <span className="hidden sm:inline font-extrabold text-[11px]">Follow Bus</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleCenterPassenger}
          title="Center on My Boarding Stop"
          className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border border-slate-200/60"
        >
          <span className="text-sm">🎯</span>
          <span className="hidden sm:inline font-extrabold text-[11px]">My Stop</span>
        </button>
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleFullscreen()
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen Radar'}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border border-slate-200/60"
          >
            <span className="text-sm">{isFullscreen ? '🗗' : '⛶'}</span>
            <span className="hidden sm:inline font-extrabold text-[11px]">
              {isFullscreen ? 'Normal' : 'Fullscreen'}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

// Generate the road corridor path connecting passenger and the incoming bus
function getTrackingPath(passengerCoords, busCoords, stops = corridorStops) {
  if (!passengerCoords || !busCoords) return []
  const [pLat] = passengerCoords
  const [bLat] = busCoords
  const minLat = Math.min(pLat, bLat)
  const maxLat = Math.max(pLat, bLat)

  const intermediate = stops
    .filter((s) => s.coords[0] > minLat && s.coords[0] < maxLat)
    .sort((a, b) => (pLat < bLat ? a.coords[0] - b.coords[0] : b.coords[0] - a.coords[0]))
    .map((s) => s.coords)

  return [passengerCoords, ...intermediate, busCoords]
}

// Custom Bus Marker Pin with Route Tag, Directional Rotation & Radar Halo
function createBusIcon(bus, isSelected, heading = 0) {
  const isExpress = (bus.service_type || '').toLowerCase().includes('express')
  const pinClass = isSelected
    ? 'marker-pin-selected'
    : isExpress
      ? 'marker-pin-express'
      : 'marker-pin-local'

  return L.divIcon({
    className: 'custom-bus-marker-container',
    html: `
      <div class="custom-bus-marker ${pinClass}">
        ${isSelected ? '<div class="bus-radar-pulse"></div>' : ''}
        <span class="marker-bus-emoji" style="display:inline-block; transform: rotate(${Math.round(heading)}deg); transition: transform 0.4s ease;">🚍</span>
        <span class="marker-route-badge">${bus.route_number || '15'}</span>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  })
}

// Custom Passenger "You / Boarding Location" Pin with animated radar ring
function createPassengerIcon() {
  return L.divIcon({
    className: 'custom-passenger-marker-container',
    html: `
      <div class="custom-passenger-marker">
        <div class="passenger-radar-ring"></div>
        <div class="passenger-pin-core">🧍‍♂️</div>
        <div class="passenger-tag">You (Boarding)</div>
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -25],
  })
}

// ZOMATO-STYLE SMOOTH GLIDING BUS MARKER WITH 60 FPS LERP INTERPOLATION
function SmoothAnimatedBusMarker({ bus, isSelected, onSelectBus }) {
  const markerRef = useRef(null)
  const animFrameRef = useRef(null)
  const prevCoordsRef = useRef([bus.latitude, bus.longitude])
  const targetCoordsRef = useRef([bus.latitude, bus.longitude])
  const startTimeRef = useRef(null)
  const [heading, setHeading] = useState(bus.heading || 0)

  const isExpress = (bus?.service_type || '').toLowerCase().includes('express')
  const busLat = bus?.latitude
  const busLng = bus?.longitude

  useEffect(() => {
    // Step 4: Handle GPS Glitches & Tunnel Drops — validate numeric coordinates
    if (
      typeof busLat !== 'number' ||
      typeof busLng !== 'number' ||
      isNaN(busLat) ||
      isNaN(busLng)
    ) {
      return
    }

    const newTarget = [busLat, busLng]
    const currentPrev = prevCoordsRef.current

    // Skip if coordinates are effectively unchanged
    if (
      Math.abs(newTarget[0] - targetCoordsRef.current[0]) < 0.00001 &&
      Math.abs(newTarget[1] - targetCoordsRef.current[1]) < 0.00001
    ) {
      return
    }

    // Step 4: Ignore unrealistic satellite jump spikes (> 0.08 deg in a single update)
    if (currentPrev && currentPrev[0] !== 0) {
      const latDiff = Math.abs(newTarget[0] - currentPrev[0])
      const lngDiff = Math.abs(newTarget[1] - currentPrev[1])
      if (latDiff > 0.08 || lngDiff > 0.08) {
        console.warn('GPS Teleportation jump spike discarded by map renderer')
        return
      }
    }

    // Compute bearing/direction of travel
    if (
      Math.abs(currentPrev[0] - newTarget[0]) > 0.00001 ||
      Math.abs(currentPrev[1] - newTarget[1]) > 0.00001
    ) {
      const calculatedHeading = calculateBearing(
        currentPrev[0],
        currentPrev[1],
        newTarget[0],
        newTarget[1]
      )
      if (!isNaN(calculatedHeading)) {
        setHeading(calculatedHeading)
      }
    }

    targetCoordsRef.current = newTarget
    startTimeRef.current = performance.now()
    const startCoords = [currentPrev[0], currentPrev[1]]
    const duration = 2400 // Smooth 2.4s glide transition between updates (Zomato-style LERP)

    const animate = (now) => {
      if (!markerRef.current) return
      const elapsed = now - (startTimeRef.current || now)
      const progress = Math.min(elapsed / duration, 1)

      // Cubic ease-out interpolation for smooth natural motion
      const easeProgress = 1 - Math.pow(1 - progress, 3)

      const lat = startCoords[0] + (targetCoordsRef.current[0] - startCoords[0]) * easeProgress
      const lng = startCoords[1] + (targetCoordsRef.current[1] - startCoords[1]) * easeProgress

      prevCoordsRef.current = [lat, lng]
      markerRef.current.setLatLng([lat, lng])

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      }
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [busLat, busLng])

  if (
    !bus ||
    typeof bus.latitude !== 'number' ||
    typeof bus.longitude !== 'number' ||
    isNaN(bus.latitude) ||
    isNaN(bus.longitude)
  ) {
    return null
  }

  return (
    <Marker
      ref={markerRef}
      position={[bus.latitude, bus.longitude]}
      icon={createBusIcon(bus, isSelected, heading)}
      eventHandlers={{
        click: () => onSelectBus?.(bus.bus_id),
      }}
    >
      <Popup>
        <div className="map-popup-card">
          <div className="popup-header">
            <div>
              <strong className="popup-bus-title">{bus.bus_name}</strong>
              <span className="popup-bus-route">
                Route {bus.route_number || '15'} • {bus.route_name || 'Mangaluru Statebank ➔ Surathkal'}
              </span>
            </div>
            <span className={`service-pill ${isExpress ? 'pill-express' : 'pill-city'}`}>
              {isExpress ? '⚡ Express' : '🚌 City'}
            </span>
          </div>

          <div className="popup-bus-details">
            <div className="popup-stat-row">
              <span>Expected Arrival:</span>
              <strong className="stat-highlight">{bus.estimated_arrival || '1:15 PM'}</strong>
            </div>
            <div className="popup-stat-row">
              <span>Stop ETA:</span>
              <strong className="stat-eta">{bus.eta_minutes ?? 3} Mins away</strong>
            </div>
            <div className="popup-stat-row">
              <span>Delay Status:</span>
              <strong className={bus.delay_minutes > 0 ? 'stat-delay' : 'stat-ontime'}>
                {bus.delay_minutes > 0 ? `+${bus.delay_minutes} Mins Late` : 'On Time'}
              </strong>
            </div>
            <div className="popup-stat-row">
              <span>Speed / Load:</span>
              <strong>{bus.speed ?? 35} km/h • {bus.crowd_status || 'Seats Available'}</strong>
            </div>
            {bus.driver_phone && (
              <div className="popup-driver-row">
                <span>📞 Driver: {bus.driver_phone}</span>
              </div>
            )}
            {bus.is_last_bus && (
              <div className="popup-last-bus-banner">
                🌙 LAST BUS OF THE NIGHT
              </div>
            )}
          </div>

          {!isSelected && onSelectBus && (
            <button
              type="button"
              className="popup-track-btn"
              onClick={() => onSelectBus(bus.bus_id)}
            >
              Track This Bus (Focus)
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  )
}

function TransitMap({
  buses = [],
  routeCoordinates = defaultRouteCoordinates,
  selectedBusId = null,
  onSelectBus = null,
  mapCenter = [12.9100, 74.8300],
  passengerCoords = [12.8718, 74.8430],
  passengerStopName = 'Mangaluru Statebank Terminal',
  isFullscreen = false,
  onToggleFullscreen = null,
}) {
  const selectedBus = buses.find((b) => b.bus_id === selectedBusId)
  const busCoords = selectedBus ? [selectedBus.latitude, selectedBus.longitude] : null

  // When a bus is selected, show ONLY that bus (like Zomato tracking your delivery partner)
  const busesToRender = selectedBusId
    ? buses.filter((b) => b.bus_id === selectedBusId)
    : buses

  // Blue route line connecting passenger directly to the selected bus along corridor
  const trackingPath = selectedBus
    ? getTrackingPath(passengerCoords, busCoords, corridorStops)
    : []

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      className="transit-map"
    >
      {/* Interactive Camera Focus & Fullscreen Controls */}
      <MapCameraControlOverlay
        passengerCoords={passengerCoords}
        busCoords={busCoords}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />

      {/* Dynamic auto-framing */}
      {selectedBus ? (
        <MapTrackingFocuser passengerCoords={passengerCoords} busCoords={busCoords} />
      ) : (
        <MapRecenter center={mapCenter} />
      )}

      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* Corridor Key Stops Circles */}
      {corridorStops.map((stop) => (
        <CircleMarker
          key={stop.name}
          center={stop.coords}
          radius={5}
          pathOptions={{
            color: '#1e3a8a',
            fillColor: '#2563eb',
            fillOpacity: 0.9,
            weight: 2,
          }}
        >
          <Popup>
            <div className="stop-popup">
              <strong>🚏 {stop.name}</strong>
              <span>Coastal Corridor Waypoint</span>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Background Corridor Polyline */}
      <Polyline
        positions={routeCoordinates}
        pathOptions={{
          color: selectedBusId ? '#94a3b8' : '#2563eb',
          weight: selectedBusId ? 3 : 5,
          dashArray: selectedBusId ? '4, 8' : undefined,
          opacity: selectedBusId ? 0.45 : 0.85,
        }}
      />

      {/* ZOMATO-STYLE BLUE NAVIGATION ROUTE LINE (Between Passenger & Selected Bus) */}
      {selectedBus && trackingPath.length >= 2 && (
        <>
          {/* Outer soft blue glowing line */}
          <Polyline
            positions={trackingPath}
            pathOptions={{
              color: '#3b82f6',
              weight: 10,
              opacity: 0.35,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          {/* Inner crisp animated navigation blue line */}
          <Polyline
            positions={trackingPath}
            pathOptions={{
              color: '#1d4ed8',
              weight: 5,
              opacity: 0.95,
              dashArray: '8, 8',
              className: 'animated-tracking-polyline',
            }}
          />
        </>
      )}

      {/* Passenger Location Marker ("You Are Here / Boarding Stop") */}
      <Marker position={passengerCoords} icon={createPassengerIcon()}>
        <Popup>
          <div className="stop-popup">
            <strong>🧍‍♂️ Your Boarding Location</strong>
            <span>{passengerStopName}</span>
            {selectedBus && (
              <p style={{ marginTop: '4px', fontSize: '11px', color: '#1d4ed8', fontWeight: 'bold' }}>
                ⚡ Tracking {selectedBus.bus_name} approaching you!
              </p>
            )}
          </div>
        </Popup>
      </Marker>

      {/* Smoothly Animated Gliding Buses (Zomato-style LERP) */}
      {busesToRender.map((bus) => (
        <SmoothAnimatedBusMarker
          key={bus.bus_id}
          bus={bus}
          isSelected={selectedBusId === bus.bus_id}
          onSelectBus={onSelectBus}
        />
      ))}
    </MapContainer>
  )
}

export default TransitMap
