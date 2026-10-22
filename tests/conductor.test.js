/**
 * tests/conductor.test.js
 * Automated validation suite for Conductor crowd controls, corridor progression,
 * and emergency road alert broadcasting.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

// 1. Crowd Capacity & Occupancy Status Helper
function getCrowdStatusFromLoad(passengers, capacity = 55) {
  const safePassengers = Math.max(0, passengers)
  const percentage = Math.round((safePassengers / capacity) * 100)

  let status = 'Seats Available'
  if (percentage > 100) {
    status = 'Full / Overcrowded'
  } else if (percentage > 70) {
    status = 'Standing Allowed'
  }

  return { safePassengers, percentage, status }
}

test('Conductor crowd capacity calculations and threshold statuses', () => {
  // Test lower occupancy (Seats Available)
  const lowLoad = getCrowdStatusFromLoad(25, 55)
  assert.equal(lowLoad.status, 'Seats Available')
  assert.equal(lowLoad.percentage, 45)

  // Test medium occupancy (Standing Allowed)
  const mediumLoad = getCrowdStatusFromLoad(45, 55)
  assert.equal(mediumLoad.status, 'Standing Allowed')
  assert.equal(mediumLoad.percentage, 82)

  // Test full occupancy (Full / Overcrowded)
  const fullLoad = getCrowdStatusFromLoad(58, 55)
  assert.equal(fullLoad.status, 'Full / Overcrowded')
  assert.equal(fullLoad.percentage, 105)

  // Negative passengers should clamp to 0
  const negativeLoad = getCrowdStatusFromLoad(-5, 55)
  assert.equal(negativeLoad.safePassengers, 0)
  assert.equal(negativeLoad.status, 'Seats Available')
})

// 2. Road Incident Alert Formatter
function formatRoadAlert(situationText, busName = 'Vishal Express') {
  return {
    id: Date.now(),
    message: `${busName}: ${situationText}`,
    timestamp: '12:30 PM',
  }
}

test('Road incident broadcaster generates valid alert payload', () => {
  const alert = formatRoadAlert('NH-66 Traffic congestion near Nanthoor. Expect minor delays.', 'Canara Pinto')
  assert.ok(typeof alert.id === 'number', 'Alert must have a numeric timestamp ID')
  assert.ok(alert.message.includes('Canara Pinto'), 'Alert must reference broadcasting bus')
  assert.ok(alert.message.includes('Nanthoor'), 'Alert must reference specific corridor bottleneck')
  assert.equal(alert.timestamp, '12:30 PM')
})

// 3. Corridor Progression Tracker along NH-66
const CORRIDOR_STOPS = [
  { name: 'Statebank', lat: 12.8718, lng: 74.8430 },
  { name: 'Hampankatta', lat: 12.8850, lng: 74.8450 },
  { name: 'Lalbagh', lat: 12.8970, lng: 74.8480 },
  { name: 'Nanthoor', lat: 12.8997, lng: 74.8530 },
  { name: 'Kuloor', lat: 12.9271, lng: 74.8415 },
  { name: 'Baikampady', lat: 12.9350, lng: 74.8150 },
  { name: 'Surathkal', lat: 12.9472, lng: 74.7963 },
]

function getCorridorProgress(busLatitude, stops = CORRIDOR_STOPS) {
  return stops.map((stop) => {
    const isCurrent = Math.abs(busLatitude - stop.lat) <= 0.005
    const isPassed = busLatitude > stop.lat + 0.003
    return { name: stop.name, isPassed, isCurrent }
  })
}

test('Corridor stop timeline accurately tracks northbound bus progression', () => {
  // Bus is currently near Lalbagh (12.8970)
  const progress = getCorridorProgress(12.8970)

  // Statebank and Hampankatta should be passed
  const statebank = progress.find(s => s.name === 'Statebank')
  const hampankatta = progress.find(s => s.name === 'Hampankatta')
  assert.equal(statebank.isPassed, true, 'Statebank should be marked as passed')
  assert.equal(hampankatta.isPassed, true, 'Hampankatta should be marked as passed')

  // Lalbagh should be current
  const lalbagh = progress.find(s => s.name === 'Lalbagh')
  assert.equal(lalbagh.isCurrent, true, 'Lalbagh should be marked as current stop')

  // Surathkal should be upcoming (not passed, not current)
  const surathkal = progress.find(s => s.name === 'Surathkal')
  assert.equal(surathkal.isPassed, false, 'Surathkal should not be passed')
  assert.equal(surathkal.isCurrent, false, 'Surathkal should not be current')
})

// 4. Proximity Sound Trigger Distance Threshold (< 1.2 km)
test('Proximity arrival chime threshold triggers within 1.2 km', () => {
  const shouldTriggerChime = (distanceKm) => distanceKm <= 1.2
  assert.equal(shouldTriggerChime(0.8), true, '0.8 km is within arrival radius')
  assert.equal(shouldTriggerChime(1.2), true, '1.2 km boundary should trigger arrival chime')
  assert.equal(shouldTriggerChime(1.5), false, '1.5 km is too far for arrival chime')
})
