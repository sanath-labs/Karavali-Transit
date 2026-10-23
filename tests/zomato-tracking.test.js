/**
 * tests/zomato-tracking.test.js
 * Automated validation suite for Zomato-style live bus telemetry:
 * 1. Smart GPS Throttling (Conductor Side)
 * 2. In-Memory WebSocket Relay (Backend Server)
 * 3. Smooth State Sync & Gliding (Passenger Side)
 * 4. GPS Glitch & Tunnel Drop Reliability
 */
import test from 'node:test'
import assert from 'node:assert/strict'

// 1. Conductor-side Smart GPS Throttling & Speed Conversion
function processGpsPosition(coords, lastSent, options = { maxSpeed: 100, minDistanceKm: 0.01, minIntervalMs: 2500 }) {
  const speed = coords.speed ? Math.round(coords.speed * 3.6) : 35 // m/s to km/h

  // Step 4: Speed Validation Check — Ignore unrealistic bus teleportation spikes
  if (speed > options.maxSpeed) {
    return { shouldEmit: false, reason: 'SPEED_SPIKE_REJECTED' }
  }

  const now = Date.now()
  if (lastSent && lastSent.coords) {
    const latDiff = Math.abs(coords.latitude - lastSent.coords[0])
    const lngDiff = Math.abs(coords.longitude - lastSent.coords[1])
    const approxDistKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111

    // Stationary throttle: if bus moved < 10m and sent within 2.5s, throttle
    if (approxDistKm < options.minDistanceKm && now - lastSent.time < options.minIntervalMs) {
      return { shouldEmit: false, reason: 'THROTTLED_STATIONARY' }
    }
  }

  return {
    shouldEmit: true,
    payload: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed,
      timestamp: now,
    },
  }
}

test('Step 1: Smart GPS Throttling converts speed and throttles rapid stationary updates', () => {
  // Speed conversion: 10 m/s -> 36 km/h
  const update1 = processGpsPosition({ latitude: 12.8718, longitude: 74.8430, speed: 10 }, null)
  assert.equal(update1.shouldEmit, true)
  assert.equal(update1.payload.speed, 36, 'Speed should be converted from m/s to 36 km/h')
  assert.ok(typeof update1.payload.timestamp === 'number', 'Payload must contain timestamp')

  // Stationary update 500ms later (< 10m and < 2500ms)
  const lastSent = { coords: [12.8718, 74.8430], time: Date.now() - 500 }
  const update2 = processGpsPosition({ latitude: 12.8718, longitude: 74.8430, speed: 0 }, lastSent)
  assert.equal(update2.shouldEmit, false)
  assert.equal(update2.reason, 'THROTTLED_STATIONARY')
})

test('Step 4: Speed Validation Check rejects impossible teleportation spikes (> 100 km/h)', () => {
  // Unrealistic spike: 35 m/s = 126 km/h
  const spikeUpdate = processGpsPosition({ latitude: 12.8718, longitude: 74.8430, speed: 35 }, null)
  assert.equal(spikeUpdate.shouldEmit, false)
  assert.equal(spikeUpdate.reason, 'SPEED_SPIKE_REJECTED')
})

// 2. Step 2: Backend In-Memory WebSocket Relay
class InMemoryBusRelay {
  constructor(initial = {}) {
    this.activeBuses = { ...initial }
  }

  updateLocation(data) {
    if (data.speed && data.speed > 100) return null
    const payload = {
      ...(this.activeBuses[data.bus_id] || {}),
      ...data,
      timestamp: data.timestamp || Date.now(),
    }
    this.activeBuses[data.bus_id] = payload
    return payload
  }

  getSnapshot() {
    return this.activeBuses
  }
}

test('Step 2: In-Memory WebSocket Relay stores active telemetry and relays immediately', () => {
  const relay = new InMemoryBusRelay({
    1: { bus_id: 1, bus_name: 'Vishal Express', latitude: 12.8718, longitude: 74.8430, speed: 38 },
  })

  // Conductor streams new GPS
  const relayed = relay.updateLocation({ bus_id: 1, latitude: 12.8850, longitude: 74.8450, speed: 42 })
  assert.ok(relayed, 'Relay should return broadcast payload')
  assert.equal(relayed.latitude, 12.8850)
  assert.equal(relayed.speed, 42)

  // Passenger connects and receives instant sync snapshot
  const snapshot = relay.getSnapshot()
  assert.equal(snapshot[1].latitude, 12.8850, 'Snapshot must have the latest in-memory coordinate')
})

// 3. Step 3 & 4: Passenger State Sync & Last Known Position Fallback
function applyLocationBroadcast(prevLiveBuses, data) {
  // Speed spike check
  if (data.speed && data.speed > 100) return prevLiveBuses

  const existing = prevLiveBuses[data.bus_id] || {}
  return {
    ...prevLiveBuses,
    [data.bus_id]: {
      ...existing,
      ...data,
      // Fallback: preserve last known position if incoming packet lacks valid coordinates (e.g. tunnel drop)
      latitude: typeof data.latitude === 'number' && !isNaN(data.latitude) ? data.latitude : existing.latitude,
      longitude: typeof data.longitude === 'number' && !isNaN(data.longitude) ? data.longitude : existing.longitude,
    },
  }
}

test('Step 3 & 4: Passenger state sync updates position and safely holds last known coordinate during tunnel drop', () => {
  const initialLiveBuses = {
    1: { bus_id: 1, bus_name: 'Vishal Express', latitude: 12.8997, longitude: 74.8530, speed: 38 },
  }

  // Normal live update
  const updatedBuses = applyLocationBroadcast(initialLiveBuses, {
    bus_id: 1,
    latitude: 12.9271,
    longitude: 74.8415,
    speed: 40,
  })
  assert.equal(updatedBuses[1].latitude, 12.9271)

  // Weak signal / Tunnel drop with invalid/null coordinate
  const fallbackBuses = applyLocationBroadcast(updatedBuses, {
    bus_id: 1,
    latitude: null,
    longitude: null,
    speed: 20,
  })
  assert.equal(fallbackBuses[1].latitude, 12.9271, 'Must hold last known coordinate during tunnel drop without crashing')
  assert.equal(fallbackBuses[1].speed, 20)
})
