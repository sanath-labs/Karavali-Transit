export function matchesDestination(bus, destination) {
  if (!destination || destination === 'All') return true

  const target = destination.toLowerCase()
  const routeDestination = bus.route_name?.split('➔').at(-1)?.trim()
  const basicMatch = [bus.destination, bus.route_to, routeDestination]
    .some((value) => value?.toLowerCase().includes(target))
  if (basicMatch) return true

  // Also match intermediate planned stops if stop is after origin
  if (Array.isArray(bus.stops) && bus.stops.length > 1) {
    return bus.stops.slice(1).some((s) => s.stop_name?.toLowerCase().includes(target))
  }
  return false
}

export function isValidIndianMobile(phone) {
  if (!phone) return false
  const clean = String(phone).replace(/\D/g, '')
  // Accepts 10 digits starting with 6, 7, 8, or 9; or with 91 / 0 prefix
  if (clean.length === 10 && /^[6-9]/.test(clean)) return true
  if (clean.length === 12 && clean.startsWith('91') && /^[6-9]/.test(clean.slice(2))) return true
  if (clean.length === 11 && clean.startsWith('0') && /^[6-9]/.test(clean.slice(1))) return true
  return false
}

export function formatIndianMobile(phone) {
  if (!phone) return ''
  const clean = String(phone).replace(/\D/g, '')
  const tenDigits = clean.length > 10 ? clean.slice(-10) : clean
  if (tenDigits.length === 10) {
    return `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`
  }
  return phone
}
