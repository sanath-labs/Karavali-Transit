import test from 'node:test'
import assert from 'node:assert/strict'
import {
  initDB,
  getBusesByOwner,
} from '../db.js'

test('Conductor Shift to Passenger Radar Synchronization Suite', async (t) => {
  await initDB()
  const baseUrl = 'http://localhost:5000'

  // Get buses for the default agency
  const agencyBuses = await getBusesByOwner('rakesh@gmail.com')
  assert.ok(agencyBuses.length > 0, 'Agency rakesh@gmail.com should have buses')
  const testBus = agencyBuses[0] // e.g. Bus 44 or Bus 78

  let conductorToken = ''

  await t.test('1. Conductor Starts Shift via /api/conductor/start-duty', async () => {
    const res = await fetch(`${baseUrl}/api/conductor/start-duty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bus_id: testBus.bus_id,
        vehicle_number: testBus.vehicle_number,
        driver_phone: '98451 12345',
        conductor_name: 'Manjunath Shetty',
      }),
    })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.success, true)
    assert.ok(data.conductor_token, 'Token must be issued')
    conductorToken = data.conductor_token
  })

  await t.test('2. Passenger Searches From Surathkal to Udupi - Shifted Bus Must Appear under Active', async () => {
    // Call the exact search endpoint that Passenger Radar calls
    const res = await fetch(`${baseUrl}/api/public/buses/search?from=Surathkal&to=Udupi`)
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.success, true)
    assert.ok(Array.isArray(data.buses), 'Buses array must be returned')

    // Find the bus on which conductor started shift
    const found = data.buses.find((b) => b.bus_id === testBus.bus_id)
    assert.ok(found, `Bus #${testBus.bus_id} must be in search results`)
    assert.equal(found.is_on_shift, true, 'is_on_shift must be true')
    assert.equal(found.tracking_status, 'NOT TRACKING', 'Status must be NOT TRACKING before GPS stream')

    // Verify Active filter logic: must qualify as Active
    const isBusActive = (b) => Boolean(
      b.is_live ||
      b.is_on_shift ||
      b.tracking_status === 'LIVE' ||
      b.tracking_status === 'LOCATION STALE' ||
      b.tracking_status === 'NOT TRACKING'
    )

    const activeList = data.buses.filter(isBusActive)
    assert.ok(activeList.some((b) => b.bus_id === testBus.bus_id), 'Shifted bus must be present in Active filter list')
  })

  await t.test('3. Conductor Starts Live GPS Telemetry Stream', async () => {
    const res = await fetch(`${baseUrl}/api/conductor/gps-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${conductorToken}`,
      },
      body: JSON.stringify({
        bus_id: testBus.bus_id,
        latitude: 13.0068,
        longitude: 74.7954,
        accuracy: 10,
        speed: 38,
        heading: 350,
        timestamp: Date.now(),
      }),
    })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.success, true)
    assert.equal(data.tracking_status, 'LIVE')
  })

  await t.test('4. Passenger Radar Immediately Reflects LIVE GPS Telemetry & Active Status', async () => {
    const res = await fetch(`${baseUrl}/api/public/buses/search?from=Surathkal&to=Udupi`)
    const data = await res.json()
    assert.equal(res.status, 200)
    const found = data.buses.find((b) => b.bus_id === testBus.bus_id)
    assert.ok(found, `Bus #${testBus.bus_id} must be in search results`)
    assert.equal(found.tracking_status, 'LIVE', 'Status must now be LIVE')
    assert.equal(found.is_live, true, 'is_live must be true')
    assert.equal(found.latitude, 13.0068)
    assert.equal(found.longitude, 74.7954)
    assert.equal(found.speed, 38)
  })

  await t.test('5. Conductor Stops Tracking - Bus Transitions out of LIVE', async () => {
    const res = await fetch(`${baseUrl}/api/conductor/stop-tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${conductorToken}`,
      },
      body: JSON.stringify({ bus_id: testBus.bus_id }),
    })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.success, true)
    assert.equal(data.tracking_status, 'OFFLINE')

    // Verify search endpoint reflects OFFLINE / SCHEDULED
    const searchRes = await fetch(`${baseUrl}/api/public/buses/search?from=Surathkal&to=Udupi`)
    const searchData = await searchRes.json()
    const found = searchData.buses.find((b) => b.bus_id === testBus.bus_id)
    assert.ok(found)
    assert.equal(found.is_live, false)
    assert.notEqual(found.tracking_status, 'LIVE')
  })
})
