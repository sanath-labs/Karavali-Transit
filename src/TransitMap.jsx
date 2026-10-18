import { useEffect } from 'react'
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
  { name: 'Surathkal (Terminus)', coords: [12.9472, 74.7963] },
]

const defaultRouteCoordinates = corridorStops.map((stop) => stop.coords)

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

// Custom Bus Marker Pin with Route Tag & Glow
function createBusIcon(bus, isSelected) {
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
        <span class="marker-bus-emoji">🚍</span>
        <span class="marker-route-badge">${bus.route_number || '15'}</span>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
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

function TransitMap({
  buses = [],
  routeCoordinates = defaultRouteCoordinates,
  selectedBusId = null,
  onSelectBus = null,
  mapCenter = [12.9100, 74.8300],
  passengerCoords = [12.8718, 74.8430],
  passengerStopName = 'Mangaluru Statebank Terminal',
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

      {/* Buses: If a bus is selected, ONLY that bus is shown; otherwise all buses */}
      {busesToRender.map((bus) => {
        const isSelected = selectedBusId === bus.bus_id
        const isExpress = (bus.service_type || '').toLowerCase().includes('express')

        return (
          <Marker
            key={bus.bus_id}
            position={[bus.latitude, bus.longitude]}
            icon={createBusIcon(bus, isSelected)}
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
      })}
    </MapContainer>
  )
}

export default TransitMap
