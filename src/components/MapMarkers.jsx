import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * MapViewportController
 * Dynamically adjusts the Leaflet map bounds, center point, and smooth flyTo transitions
 * based on corridor boundaries, live GPS bus telemetry, and user location focus.
 *
 * @param {Object} props
 * @param {Array<Array<number>>} [props.bounds] - 2D bounding box coordinates [[minLat, minLng], [maxLat, maxLng]]
 * @param {Array<number>} [props.center] - [latitude, longitude] center point for fallback view
 * @param {boolean} [props.hasLiveCoordinates] - Whether bus is currently streaming live GPS coordinates
 * @param {Array<number>} [props.flyTarget] - [latitude, longitude, zoom] for smooth Google Maps flyTo animation
 */
export function MapViewportController({
  bounds,
  center,
  hasLiveCoordinates = false,
  flyTarget = null,
}) {
  const map = useMap()

  // Google Maps-like smooth flyTo animation on user interaction
  useEffect(() => {
    if (flyTarget && Array.isArray(flyTarget) && flyTarget.length >= 2) {
      const [lat, lng, zoom = 16] = flyTarget
      if (typeof lat === 'number' && typeof lng === 'number') {
        map.flyTo([lat, lng], zoom, {
          duration: 1.2,
          easeLinearity: 0.25,
        })
      }
    }
  }, [flyTarget, map])

  // Automatic centering and corridor fit
  useEffect(() => {
    if (hasLiveCoordinates && center && typeof center[0] === 'number' && typeof center[1] === 'number') {
      map.setView(center, 15, { animate: true })
    } else if (bounds && bounds.length >= 2) {
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
  }, [bounds, center, hasLiveCoordinates, map])

  return null
}
