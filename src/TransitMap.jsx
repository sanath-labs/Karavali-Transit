import L from 'leaflet'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
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

export default function TransitMap() {
  return (
    <MapContainer center={[12.9100, 74.8300]} zoom={13} className="transit-map">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {corridorStops.map((stop) => (
        <CircleMarker key={stop.name} center={stop.coords} radius={5} pathOptions={{ color: '#1e3a8a', fillColor: '#2563eb', fillOpacity: 0.9, weight: 2 }}>
          <Popup><strong>🚏 {stop.name}</strong></Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
