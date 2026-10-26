export function matchesDestination(bus, destination) {
  if (!destination || destination === 'All') return true

  const target = destination.toLowerCase()
  const routeDestination = bus.route_name?.split('➔').at(-1)?.trim()
  return [bus.destination, bus.route_to, routeDestination]
    .some((value) => value?.toLowerCase().includes(target))
}
