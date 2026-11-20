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
  isOutOfCorridor = false,
  flyTarget = null,
}) {
  const map = useMap()

  // 1. Critical Leaflet size invalidation fix to prevent squished/clustered layout on initial mount
  useEffect(() => {
    map.invalidateSize()
    const timer1 = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    const timer2 = setTimeout(() => {
      map.invalidateSize()
    }, 600)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [map])

  // 2. Smooth Google Maps-like flyTo animation on user interaction
  useEffect(() => {
    if (flyTarget && Array.isArray(flyTarget) && flyTarget.length >= 2) {
      const [lat, lng, zoom = 15] = flyTarget
      if (typeof lat === 'number' && typeof lng === 'number') {
        map.flyTo([lat, lng], zoom, {
          duration: 1.2,
          easeLinearity: 0.25,
        })
      }
    }
  }, [flyTarget, map])

  // 3. Automatic centering and corridor fit (Prioritize corridor when bus GPS is out of bounds/ISP IP)
  useEffect(() => {
    if (flyTarget) return // User manually triggered camera move

    if (hasLiveCoordinates && !isOutOfCorridor && center && typeof center[0] === 'number' && typeof center[1] === 'number') {
      map.setView(center, 15, { animate: true })
    } else if (bounds && bounds.length >= 2) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 })
      } catch {
        if (center && center[0] && center[1]) {
          map.setView(center, 12, { animate: true })
        }
      }
    } else if (center && center[0] && center[1]) {
      map.setView(center, 12, { animate: true })
    }
  }, [bounds, center, hasLiveCoordinates, isOutOfCorridor, flyTarget, map])

  return null
}
