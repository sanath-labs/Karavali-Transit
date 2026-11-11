/**
 * src/shiftLedger.js
 * Conductor Shift Summary Report & Corridor Revenue Ledger Generator
 * Calculates shift duration, cumulative passenger ridership, and stage revenue.
 */

/**
 * Generates an end-of-shift receipt / summary report
 * @param {Object} options Shift report input parameters
 * @returns {Object} Compiled shift summary waybill
 */
export function generateShiftSummary({
  busName = 'Vishal Express',
  vehicleNumber = 'KA-19-AB-4509',
  routeNumber = '15',
  serviceType = 'Express',
  origin = 'Mangaluru Statebank',
  destination = 'Surathkal',
  startTime = Date.now() - 7200000, // 2 hours ago
  endTime = Date.now(),
  currentPassengers = 24,
}) {
  const durationMs = Math.max(60000, endTime - startTime)
  const durationMinutes = Math.round(durationMs / 60000)
  const hours = Math.floor(durationMinutes / 60)
  const mins = durationMinutes % 60
  const durationFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`

  const isExpress = (serviceType || '').toLowerCase().includes('express')
  const avgFare = isExpress ? 35 : 25
  const totalPassengers = Math.max(currentPassengers, currentPassengers * 3 + 12)
  const estimatedRevenue = totalPassengers * avgFare
  const distanceKm = Math.max(18, Math.round(durationMinutes * 0.55))

  const startFormatted = new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const endFormatted = new Date(endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return {
    waybillId: `KSR-${Math.floor(100000 + Math.random() * 900000)}`,
    busName,
    vehicleNumber,
    routeNumber,
    route: `${origin} ➔ ${destination}`,
    serviceType,
    startTime: startFormatted,
    endTime: endFormatted,
    durationMinutes,
    durationFormatted,
    totalPassengers,
    avgFare,
    estimatedRevenue,
    distanceKm,
    timestamp: new Date(endTime).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
  }
}
