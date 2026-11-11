import test from 'node:test'
import assert from 'node:assert/strict'
import {
  initDB,
  createOwner,
  saveBus,
  saveConductor,
  getRecentTelemetry,
} from '../db.js'

test('Conductor Real-Time GPS Tracking & Telemetry Security Suite', async (t) => {
  await initDB()
  const baseUrl = 'http://localhost:5000'

  const ownerEmail = `gps_fleet_${Date.now()}@gmail.com`
  await createOwner(ownerEmail, 'Mangaluru Coastal Transport')

  // Create Bus 1
  const bus1 = await saveBus({
    owner_email: ownerEmail,
    bus_name: 'Durga Coastal Highway',
    vehicle_number: `KA-19-GPS-${Math.floor(1000 + Math.random() * 9000)}`,
    route_number: '001',
    service_type: 'Non AC',
    origin: 'Mangaluru',
    destination: 'Kundapura',
    total_seats: 45,
    departure_time: '08:00 AM',
    stops: [
      { id: 1, stop_name: 'Mangaluru', planned_arrival: '08:00 AM' },
      { id: 2, stop_name: 'Surathkal', planned_arrival: '08:35 AM' },
      { id: 3, stop_name: 'Kundapura', planned_arrival: '10:15 AM' },
    ],
  })

  // Create Bus 2 (Different bus for assignment mismatch test)
  const bus2 = await saveBus({
    owner_email: ownerEmail,
    bus_name: 'Lakshmi Coastal Express',
    vehicle_number: `KA-20-GPS-${Math.floor(1000 + Math.random() * 9000)}`,
    route_number: '002',
    service_type: 'Express',
    origin: 'Mangaluru',
    destination: 'Udupi',
    total_seats: 50,
    departure_time: '09:00 AM',
    stops: [
      { id: 1, stop_name: 'Mangaluru', planned_arrival: '09:00 AM' },
      { id: 2, stop_name: 'Udupi', planned_arrival: '10:45 AM' },
    ],
  })

  // Create Conductor assigned to Bus 1
  const conductorPhone = `9845${Math.floor(100000 + Math.random() * 900000)}`
  const conductor = await saveConductor({
    owner_email: ownerEmail,
    name: 'Suresh Acharya',
    phone: conductorPhone,
    assigned_bus_id: bus1.bus_id,
  })

  let conductorToken = ''

  await t.test('1. Conductor Duty Initialization & Token Generation', async () => {
    const res = await fetch(`${baseUrl}/api/conductor/start-duty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bus_id: bus1.bus_id,
        vehicle_number: bus1.vehicle_number,
        driver_phone: conductorPhone,
        conductor_name: 'Suresh Acharya',
        conductor_id: conductor.conductor_id,
      }),
    })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.success, true)
    assert.ok(data.conductor_token, 'Duty start must issue a valid conductor session token')
    conductorToken = data.conductor_token
  })

  await t.test('2. Reject Unauthenticated GPS Telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/conductor/gps-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bus_id: bus1.bus_id,
        latitude: 13.0068,
        longitude: 74.7954,
        accuracy: 12,
        speed: 45,
        heading: 350,
        timestamp: Date.now(),
      }),
    })
    assert.equal(res.status, 401, 'Must reject telemetry request without Bearer token')
    const data = await res.json()
    assert.equal(data.success, false)
  })

  await t.test('3. Reject Telemetry for Bus Not Assigned to Conductor', async () => {
    // Attempting to stream GPS for Bus 2 while token is bound to Bus 1
    const res = await fetch(`${baseUrl}/api/conductor/gps-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${conductorToken}`,
      },
      body: JSON.stringify({
        bus_id: bus2.bus_id, // Unassigned bus!
        latitude: 13.0068,
        longitude: 74.7954,
        accuracy: 10,
        speed: 40,
        heading: 350,
        timestamp: Date.now(),
      }),
    })
    assert.equal(res.status, 403, 'Must reject conductor trying to track a bus they are not assigned to')
    const data = await res.json()
    assert.equal(data.success, false)
    assert.ok(data.error.includes('not assigned'))
  })

  await t.test('4. Reject Invalid Coordinates Outside Coastal Corridor', async () => {
    // GPS coordinates in Bengaluru (12.9716, 77.5946) -> far outside coastal NH-66
    const res = await fetch(`${baseUrl}/api/conductor/gps-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${conductorToken}`,
      },
      body: JSON.stringify({
        bus_id: bus1.bus_id,
        latitude: 12.9716,
        longitude: 77.5946, // Longitude > 76.0 is out of corridor
        accuracy: 15,
        speed: 50,
        heading: 0,
        timestamp: Date.now(),
      }),
    })
    assert.equal(res.status, 400, 'Must reject coordinates outside coastal corridor')
    const data = await res.json()
    assert.equal(data.success, false)
    assert.ok(data.error.includes('outside the coastal Karnataka corridor'))
  })

  await t.test('5. Reject Impossible Speed Spikes (> 110 km/h)', async () => {
    const res = await fetch(`${baseUrl}/api/conductor/gps-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${conductorToken}`,
      },
      body: JSON.stringify({
        bus_id: bus1.bus_id,
        latitude: 13.0068,
        longitude: 74.7954,
        accuracy: 8,
        speed: 150, // Impossible speed for coastal private bus
        heading: 350,
        timestamp: Date.now(),
      }),
    })
    assert.equal(res.status, 400, 'Must reject speed anomalies exceeding bus limits')
    const data = await res.json()
    assert.equal(data.success, false)
    assert.ok(data.error.includes('anomaly'))
  })

  await t.test('6. Ingest Valid Real-Time Smartphone GPS Telemetry', async () => {
    // Real coordinates near Surathkal NH-66
    const validLat = 13.0068
    const validLng = 74.7954
    const validSpeed = 48
    const validHeading = 352
    const validAccuracy = 12

    const res = await fetch(`${baseUrl}/api/conductor/gps-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${conductorToken}`,
      },
      body: JSON.stringify({
        bus_id: bus1.bus_id,
        latitude: validLat,
        longitude: validLng,
        accuracy: validAccuracy,
        speed: validSpeed,
        heading: validHeading,
        crowd_status: 'Seats Available',
        passenger_count: 22,
        timestamp: Date.now(),
      }),
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.equal(data.tracking_status, 'LIVE')
    assert.equal(data.location.latitude, validLat)
    assert.equal(data.location.longitude, validLng)
    assert.equal(data.location.speed, validSpeed)

    // Verify written to database table
    const recentLogs = await getRecentTelemetry(10)
    const savedLog = recentLogs.find((l) => Number(l.bus_id) === Number(bus1.bus_id))
    assert.ok(savedLog, 'Telemetry record must be persisted in database')
    assert.equal(Math.round(savedLog.latitude * 10000), Math.round(validLat * 10000))
  })

  await t.test('7. Passenger Public API Returns LIVE Tracking Status & Sensor Data', async () => {
    const res = await fetch(`${baseUrl}/api/public/buses/${bus1.bus_id}/location`)
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.equal(data.tracking_status, 'LIVE')
    assert.ok(data.location)
    assert.equal(data.location.speed, 48)
    assert.equal(data.location.is_stale, false)
  })

  await t.test('8. Conductor Stop Tracking Flow Marks Bus Offline', async () => {
    const res = await fetch(`${baseUrl}/api/conductor/stop-tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${conductorToken}`,
      },
      body: JSON.stringify({
        bus_id: bus1.bus_id,
      }),
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.equal(data.tracking_status, 'OFFLINE')

    // Verify public location is now OFFLINE
    const locRes = await fetch(`${baseUrl}/api/public/buses/${bus1.bus_id}/location`)
    const locData = await locRes.json()
    assert.equal(locData.tracking_status, 'OFFLINE')
  })
})

