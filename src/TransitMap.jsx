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

function MapRecenter({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2 && center[0] && center[1]) {
      map.setView(center, 14, { animate: true })
    }
  }, [center, map])
  return null
}

function TransitMap({
  buses = [],
  routeCoordinates = defaultRouteCoordinates,
  selectedBusId = null,
  onSelectBus = null,
  mapCenter = [12.9100, 74.8300],
}) {
  const selectedBus = buses.find((b) => b.bus_id === selectedBusId)
  const targetCenter = selectedBus ? [selectedBus.latitude, selectedBus.longitude] : null

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      className="transit-map"
    >
      <MapRecenter center={targetCenter} />
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

      {/* Route Map Polyline - Official Blue for active tracking */}
      <Polyline
        positions={routeCoordinates}
        pathOptions={{
          color: selectedBusId ? '#1d4ed8' : '#2563eb',
          weight: selectedBusId ? 6 : 4,
          dashArray: selectedBusId ? undefined : '6, 6',
          opacity: selectedBusId ? 0.95 : 0.75,
        }}
      />

      {/* Live Buses */}
      {buses.map((bus) => {
        const isSelected = selectedBusId === bus.bus_id
        const isExpress = (bus.service_type || '').toLowerCase().includes('express')

        return (
          <Marker
            key={bus.bus_id}
            position={[bus.latitude, bus.longitude]}
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
