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
