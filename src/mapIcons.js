import L from 'leaflet'

/**
 * Google Maps style pulsing blue dot for the user's current device location
 */
export const userLocationIcon = L.divIcon({
  className: 'custom-user-location-marker',
  html: `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;">
      <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(37,99,235,0.25);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:relative;width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
})

/**
 * Google Maps style live bus marker with optional heading arrow and pulse ring
 */
export const busLiveIcon = L.divIcon({
  className: 'custom-bus-live-marker',
  html: `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:48px;height:48px;">
      <div style="position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(16,185,129,0.3);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:relative;width:38px;height:38px;border-radius:50%;background:#059669;color:#ffffff;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(5,150,105,0.5);display:flex;align-items:center;justify-content:center;font-size:18px;">
        🚍
      </div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -24],
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
