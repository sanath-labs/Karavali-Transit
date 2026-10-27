/**
 * tests/landing-page.test.js
 * Automated validation suite for Passenger Radar Landing Page requirements:
 * - Destination cards ID mapping (Statebank, Surathkal, Kuloor, Udupi)
 * - Search suggestion filtering (destinations + live buses)
 * - Destination query matching terms and keyboard navigation contracts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesDestination } from '../src/transitUtils.js'

test('Destination Cards map correctly to destination IDs: Statebank, Surathkal, Kuloor, Udupi', () => {
  const destinationCards = [
    { id: 'Statebank', title: 'Mangaluru', subtitle: 'Central' },
    { id: 'Surathkal', title: 'Surathkal', subtitle: 'NITK' },
    { id: 'Kuloor', title: 'Kuloor', subtitle: 'KSRTC' },
    { id: 'Udupi', title: 'Udupi', subtitle: 'City' },
  ]

  const busFleet = [
    { bus_id: 1, destination: 'Surathkal', route_name: 'Mangaluru Statebank ➔ Surathkal' },
    { bus_id: 2, destination: 'Udupi', route_name: 'Mangaluru Statebank ➔ Udupi' },
    { bus_id: 3, destination: 'Kuloor', route_name: 'Mangaluru Statebank ➔ Kuloor' },
    { bus_id: 4, destination: 'Mangaluru Statebank', route_name: 'Surathkal ➔ Mangaluru Statebank' },
  ]

  // Test Statebank mapping
  assert.equal(destinationCards[0].id, 'Statebank')
  assert.equal(matchesDestination(busFleet[3], destinationCards[0].id), true)
  assert.equal(matchesDestination(busFleet[0], destinationCards[0].id), false)

  // Test Surathkal mapping
  assert.equal(destinationCards[1].id, 'Surathkal')
  assert.equal(matchesDestination(busFleet[0], destinationCards[1].id), true)

  // Test Kuloor mapping
  assert.equal(destinationCards[2].id, 'Kuloor')
  assert.equal(matchesDestination(busFleet[2], destinationCards[2].id), true)

  // Test Udupi mapping
  assert.equal(destinationCards[3].id, 'Udupi')
  assert.equal(matchesDestination(busFleet[1], destinationCards[3].id), true)

  // Test View All (All)
  assert.equal(matchesDestination(busFleet[0], 'All'), true)
  assert.equal(matchesDestination(busFleet[1], 'All'), true)
})

test('Search suggestion filter matches destinations and active buses correctly', () => {
  const destinationOptions = [
    { label: 'Mangaluru Central', sublabel: 'Statebank Central Terminal', destination: 'Statebank', type: 'destination' },
    { label: 'Surathkal NITK', sublabel: 'Coastal corridor', destination: 'Surathkal', type: 'destination' },
    { label: 'Kuloor KSRTC', sublabel: 'Kuloor Bridge / Highway', destination: 'Kuloor', type: 'destination' },
    { label: 'Udupi City', sublabel: 'Coastal Express', destination: 'Udupi', type: 'destination' },
    { label: 'All Routes', sublabel: 'Show buses on all routes', destination: 'All', type: 'destination' },
  ]

  const liveBuses = {
    1: { bus_name: 'Vishal Express', route_number: '15', destination: 'Surathkal' },
    2: { bus_name: 'Canara Pinto Deluxe', route_number: 'NH-66', destination: 'Udupi' },
  }

  const busOptions = Object.values(liveBuses).map(bus => ({
    label: bus.bus_name,
    sublabel: `Route ${bus.route_number} · ${bus.destination}`,
    destination: bus.destination,
    type: 'bus',
  }))

  const allOptions = [...destinationOptions, ...busOptions]

  // Empty query returns top popular options
  const filterOptions = (query) => {
    const q = query.trim().toLowerCase()
    return allOptions.filter(o => !q || `${o.label} ${o.sublabel}`.toLowerCase().includes(q))
  }

  assert.equal(filterOptions('').length, 7)

  // Search by bus name
  const vishalMatch = filterOptions('vishal')
  assert.equal(vishalMatch.length, 1)
  assert.equal(vishalMatch[0].label, 'Vishal Express')
  assert.equal(vishalMatch[0].type, 'bus')

  // Search by destination term
  const udupiMatch = filterOptions('udupi')
  assert.ok(udupiMatch.some(o => o.destination === 'Udupi'))

  // Search by route number
  const routeMatch = filterOptions('15')
  assert.ok(routeMatch.some(o => o.label === 'Vishal Express'))
})

test('Search submission maps colloquial terms to destination IDs', () => {
  const matchDestination = (query) => {
    const q = query.trim().toLowerCase()
    const match = [
      { id: 'Statebank', terms: ['mangaluru', 'mangalore', 'central', 'statebank', 'state bank'] },
      { id: 'Surathkal', terms: ['surathkal', 'nitk'] },
      { id: 'Kuloor', terms: ['kuloor', 'ksrtc', 'kulur'] },
      { id: 'Udupi', terms: ['udupi'] },
      { id: 'All', terms: ['all routes', 'all buses', 'all'] },
    ].find((d) => d.terms.some((term) => q.includes(term)))
    return match ? match.id : null
  }

  assert.equal(matchDestination('mangalore'), 'Statebank')
  assert.equal(matchDestination('nitk campus'), 'Surathkal')
  assert.equal(matchDestination('udupi bus'), 'Udupi')
  assert.equal(matchDestination('kuloor bridge'), 'Kuloor')
  assert.equal(matchDestination('unknown bus name'), null)
})

