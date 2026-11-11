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
 */
export function MapViewportController({ bounds, center }) {
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
