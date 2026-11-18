import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * MapViewportController
 * Dynamically adjusts the Leaflet map bounds and center point based on corridor
 * boundaries and live GPS bus telemetry updates.
 *
 * @param {Object} props
 * @param {Array<Array<number>>} [props.bounds] - 2D bounding box coordinates [[minLat, minLng], [maxLat, maxLng]]
 * @param {Array<number>} [props.center] - [latitude, longitude] center point for fallback view
 * @param {boolean} [props.hasLiveCoordinates] - Whether bus is currently streaming live GPS coordinates
 */
export function MapViewportController({ bounds, center, hasLiveCoordinates = false }) {
  const map = useMap()

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
