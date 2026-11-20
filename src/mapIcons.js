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
 * Google Maps style live bus marker with pulsing halo
 */
export const busLiveIcon = L.divIcon({
  className: 'custom-bus-live-marker',
  html: `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:48px;height:48px;">
      <div style="position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(16,185,129,0.35);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:relative;width:38px;height:38px;border-radius:50%;background:#059669;color:#ffffff;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(5,150,105,0.5);display:flex;align-items:center;justify-content:center;font-size:18px;">
        🚍
      </div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -24],
})

/**
 * Clean, non-colliding corridor stop pins:
 * - Boarding Stop: prominent green pill (📍 From)
 * - Destination Stop: prominent red pill (🚩 To)
 * - Intermediate Waypoint Stops: clean 12px station dots (never overlap or clutter the map)
 */
export const stopPinIcon = (name, isDestination = false, isBoarding = false) => {
  if (isDestination) {
    return L.divIcon({
      className: 'custom-stop-pin-dest',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;transform:translateY(-6px);">
          <div style="background:#e11d48;color:#ffffff;border:2px solid #ffffff;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:900;box-shadow:0 3px 8px rgba(225,29,72,0.4);white-space:nowrap;">
            🚩 ${name}
          </div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #e11d48;"></div>
        </div>
      `,
      iconSize: [100, 32],
      iconAnchor: [50, 32],
      popupAnchor: [0, -32],
    })
  }

  if (isBoarding) {
    return L.divIcon({
      className: 'custom-stop-pin-board',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;transform:translateY(-6px);">
          <div style="background:#059669;color:#ffffff;border:2px solid #ffffff;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:900;box-shadow:0 3px 8px rgba(5,150,105,0.4);white-space:nowrap;">
            📍 ${name}
          </div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #059669;"></div>
        </div>
      `,
      iconSize: [100, 32],
      iconAnchor: [50, 32],
      popupAnchor: [0, -32],
    })
  }

  // Intermediate Highway Waypoint Stops: Clean transit dot that never overlaps
  return L.divIcon({
    className: 'custom-stop-pin-waypoint',
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;" title="${name}">
        <div style="width:12px;height:12px;border-radius:50%;background:#ffffff;border:3px solid #2563eb;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  })
}
