/**
 * src/fareRules.js
 * Official Coastal Karnataka Stage Fare Matrix & Bus Sorting Utilities
 * Corridor: Mangaluru Statebank ➔ Surathkal ➔ Mulki ➔ Udupi (NH-66)
 */

export const FARE_MATRIX = {
  kuloor: { express: 20, ordinary: 15 },
  baikampady: { express: 20, ordinary: 15 },
  panambur: { express: 20, ordinary: 15 },
  surathkal: { express: 35, ordinary: 25 },
  mukka: { express: 40, ordinary: 30 },
  mulki: { express: 55, ordinary: 45 },
  padubidri: { express: 65, ordinary: 50 },
  kaup: { express: 80, ordinary: 65 },
  katapadi: { express: 85, ordinary: 70 },
  udupi: { express: 95, ordinary: 75 },
  manipal: { express: 105, ordinary: 85 },
  default: { express: 30, ordinary: 20 },
}

/**
 * Calculates estimated corridor stage fare based on bus service type and destination
 * @param {Object} bus Bus object containing service_type
 * @param {string} destination Target destination string
 * @returns {number} Fare in Indian Rupees (₹)
 */
export function calculateEstimatedFare(bus, destination = '') {
  const isExpress = (bus?.service_type || '').toLowerCase().includes('express')
  const destStr = (destination || bus?.destination || '').toLowerCase().trim()

  for (const [key, rates] of Object.entries(FARE_MATRIX)) {
    if (key !== 'default' && destStr.includes(key)) {
      return isExpress ? rates.express : rates.ordinary
    }
  }

  return isExpress ? FARE_MATRIX.default.express : FARE_MATRIX.default.ordinary
}

/**
 * Sorts active buses according to user criteria: 'eta' | 'fare' | 'seats'
 * @param {Array} buses List of bus objects
 * @param {string} sortBy Sort criterion
 * @param {string} destination Destination context for fare calculation
 * @returns {Array} Sorted shallow copy of buses
 */
export function sortBuses(buses, sortBy = 'eta', destination = '') {
  if (!Array.isArray(buses)) return []
  const list = [...buses]

  if (sortBy === 'fare') {
    return list.sort((a, b) => {
      const fareA = calculateEstimatedFare(a, destination)
      const fareB = calculateEstimatedFare(b, destination)
      return fareA - fareB
    })
  }

  if (sortBy === 'seats') {
    const crowdScore = (status) => {
      const s = (status || '').toLowerCase()
      if (s.includes('seats')) return 0
      if (s.includes('standing')) return 1
      return 2
    }
    return list.sort((a, b) => crowdScore(a.crowd_status) - crowdScore(b.crowd_status))
  }

  // Default: sort by ETA (earliest first)
  return list.sort((a, b) => {
    const etaA = typeof a.eta_minutes === 'number' ? a.eta_minutes : 5
    const etaB = typeof b.eta_minutes === 'number' ? b.eta_minutes : 5
    return etaA - etaB
  })
}
