/**
 * tests/journey.test.js
 * Automated validation suite for the 3-Step Passenger Journey calculations.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(1))
}

test('Haversine distance calculation between coastal stops', () => {
  // Statebank Terminal to Surathkal Bus Stand (~10.5 km)
  const distance = calculateDistanceKm(12.8718, 74.8430, 12.9472, 74.7963)
  assert.ok(distance >= 9.5 && distance <= 11.5, `Distance should be ~10.5 km, got ${distance}`)
})

test('Destination filtering matching rules', () => {
  const mockBuses = [
    { bus_id: 1, bus_name: 'Vishal Express', destination: 'Surathkal', route_name: 'Mangaluru Statebank ➔ Surathkal' },
    { bus_id: 2, bus_name: 'Canara Pinto', destination: 'Udupi', route_name: 'Mangaluru Statebank ➔ Udupi' },
    { bus_id: 3, bus_name: 'Padmambika', destination: 'Kuloor', route_name: 'Mangaluru Statebank ➔ Kuloor' },
    { bus_id: 4, bus_name: 'Coastal Star', destination: 'Mangaluru Statebank', origin: 'Surathkal', route_name: 'Surathkal ➔ Mangaluru Statebank' },
  ]

  // Filter for Surathkal
  const surathkalFilter = mockBuses.filter(b => b.destination.includes('Surathkal') || b.origin?.includes('Surathkal'))
  assert.equal(surathkalFilter.length, 2, 'Should match 2 buses for Surathkal corridor')

  // Filter for Udupi
  const udupiFilter = mockBuses.filter(b => b.destination.includes('Udupi'))
  assert.equal(udupiFilter.length, 1, 'Should match 1 bus for Udupi corridor')
  assert.equal(udupiFilter[0].bus_name, 'Canara Pinto')
})

test('Delay status classification based on speed threshold', () => {
  const calculateDelay = (speed) => (speed < 25 ? 4 : 0)
  assert.equal(calculateDelay(38), 0, 'Normal speed should result in 0 delay (On Time)')
  assert.equal(calculateDelay(18), 4, 'Slow speed in congestion should predict +4m delay')
})
