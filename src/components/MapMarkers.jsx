import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'

export const busLiveIcon = L.divIcon({
  className: 'custom-bus-live-marker',
  html: `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;">
      <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(37,99,235,0.25);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:relative;width:34px;height:34px;border-radius:50%;background:#2563eb;color:#fff;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(37,99,235,0.5);display:flex;align-items:center;justify-content:center;font-size:16px;">
        🚍
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -22],
})

export const stopPinIcon = (name, isDestination = false, isBoarding = false) => {
  let borderColor = '#2563eb'
  let textColor = '#1e293b'
  let dotColor = '#2563eb'
  let iconPrefix = ''

  if (isDestination) {
    borderColor = '#e11d48'
    textColor = '#e11d48'
    dotColor = '#e11d48'
    iconPrefix = '🚩 '
  } else if (isBoarding) {
    borderColor = '#059669'
    textColor = '#059669'
    dotColor = '#059669'
    iconPrefix = '📍 '
  }

  return L.divIcon({
    className: 'custom-stop-pin',
    html: `
    <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
      <div style="background:#ffffff;border:1.5px solid ${borderColor};padding:2px 7px;border-radius:12px;font-size:11px;font-weight:800;color:${textColor};box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;">
        ${iconPrefix}${name}
      </div>
      <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};border:2px solid #ffffff;box-shadow:0 2px 4px rgba(0,0,0,0.3);margin-top:2px;"></div>
    </div>
  `,
    iconSize: [80, 36],
    iconAnchor: [40, 32],
    popupAnchor: [0, -32],
  })
}

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
