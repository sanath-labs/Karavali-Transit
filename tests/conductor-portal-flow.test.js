import test from 'node:test'
import assert from 'node:assert/strict'
import {
  initDB,
  createOwner,
  saveBus,
  saveConductor,
  getConductorByPhoneAndOwner,
  getBusRouteStops,
} from '../db.js'

test('Conductor DB: Query conductor by phone and owner agency', async () => {
  await initDB()
  const agencyEmail = `agency_${Date.now()}@gmail.com`
  await createOwner(agencyEmail, 'Karavali Coastal Lines')

  // Save a bus under agency
  const busResult = await saveBus({
    owner_email: agencyEmail,
    bus_name: 'Karavali Express',
    vehicle_number: `KA-20-C-${Math.floor(1000 + Math.random() * 9000)}`,
    route_number: '101',
    service_type: 'Non AC',
    origin: 'Mangaluru',
    destination: 'Udupi',
    total_seats: 48,
    photo_url: '',
    departure_time: '07:15 AM',
    conductor_pin: '1234',
    stops: [
      { id: 1, stop_name: 'Statebank', planned_arrival: '07:15 AM' },
      { id: 2, stop_name: 'Surathkal', planned_arrival: '07:45 AM' },
      { id: 3, stop_name: 'Udupi City Bus Stand', planned_arrival: '08:30 AM' },
    ],
  })

  // 1. Check conductor lookup before registration -> should be null
  const testPhone = `9845${Math.floor(100000 + Math.random() * 900000)}`
  const notFound = await getConductorByPhoneAndOwner(agencyEmail, testPhone)
  assert.equal(notFound, null)

  // 2. Save conductor
  const savedConductor = await saveConductor({
    owner_email: agencyEmail,
    name: 'Ganesh Shetty',
    phone: testPhone,
    assigned_bus_id: busResult.bus_id,
  })
  assert.ok(savedConductor)
  assert.equal(savedConductor.name, 'Ganesh Shetty')

  // 3. Check lookup after registration -> should find conductor with bus details
  const found = await getConductorByPhoneAndOwner(agencyEmail, testPhone)
  assert.ok(found)
  assert.equal(found.name, 'Ganesh Shetty')
  assert.equal(found.phone, testPhone)
  assert.equal(found.bus_name, 'Karavali Express')

  // 4. Verify route stops can be retrieved for the assigned bus
  const stops = await getBusRouteStops(busResult.bus_id)
  assert.equal(stops.length, 3)
  assert.equal(stops[0].stop_name, 'Statebank')
  assert.equal(stops[2].stop_name, 'Udupi City Bus Stand')
})

test('Conductor HTTP API Flow: send-otp, verify-otp, lookup, and register', async () => {
  // Test endpoints against running backend (http://localhost:5000)
  const baseUrl = 'http://localhost:5000'

  // Step 1: Send OTP for existing agency
  const sendRes = await fetch(`${baseUrl}/api/conductor/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rakesh@gmail.com' }),
  })
  const sendData = await sendRes.json()
  assert.equal(sendRes.status, 200)
  assert.equal(sendData.success, true)
  assert.ok(sendData.preview_otp)
  assert.equal(sendData.preview_otp.length, 6)

  // Step 2: Verify OTP
  const verifyRes = await fetch(`${baseUrl}/api/conductor/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rakesh@gmail.com',
      otp: sendData.preview_otp,
    }),
  })
  const verifyData = await verifyRes.json()
  assert.equal(verifyRes.status, 200)
  assert.equal(verifyData.success, true)
  assert.ok(verifyData.agency?.token)

  // Step 3: Lookup existing conductor
  const lookupRes = await fetch(`${baseUrl}/api/conductor/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agency_email: 'rakesh@gmail.com',
      phone: '9845112345',
      agency_token: verifyData.agency.token,
    }),
  })
  const lookupData = await lookupRes.json()
  assert.equal(lookupRes.status, 200)
  assert.equal(lookupData.success, true)
  assert.equal(lookupData.exists, true)
  assert.ok(lookupData.conductor)
  assert.ok(lookupData.buses?.length > 0)

  // Step 4: Lookup non-existent conductor phone -> returns exists: false
  const newPhone = `9845${Math.floor(100000 + Math.random() * 900000)}`
  const lookupNewRes = await fetch(`${baseUrl}/api/conductor/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agency_email: 'rakesh@gmail.com',
      phone: newPhone,
      agency_token: verifyData.agency.token,
    }),
  })
  const lookupNewData = await lookupNewRes.json()
  assert.equal(lookupNewRes.status, 200)
  assert.equal(lookupNewData.success, true)
  assert.equal(lookupNewData.exists, false)

  // Step 5: Register new conductor
  const regRes = await fetch(`${baseUrl}/api/conductor/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agency_email: 'rakesh@gmail.com',
      name: 'Naveen Kumar',
      phone: newPhone,
      assigned_bus_id: lookupData.buses[0].bus_id,
    }),
  })
  const regData = await regRes.json()
  assert.equal(regRes.status, 200)
  assert.equal(regData.success, true)
  assert.equal(regData.conductor.name, 'Naveen Kumar')

  // Step 6: Start duty for bus
  const dutyRes = await fetch(`${baseUrl}/api/conductor/start-duty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bus_id: lookupData.buses[0].bus_id,
      vehicle_number: lookupData.buses[0].vehicle_number,
      driver_phone: newPhone,
      conductor_name: 'Naveen Kumar',
    }),
  })
  const dutyData = await dutyRes.json()
  assert.equal(dutyRes.status, 200)
  assert.equal(dutyData.success, true)
  assert.ok(dutyData.shift)

  // Step 7: Get route stops for bus
  const stopsRes = await fetch(`${baseUrl}/api/conductor/buses/${lookupData.buses[0].bus_id}/stops`)
  const stopsData = await stopsRes.json()
  assert.equal(stopsRes.status, 200)
  assert.equal(stopsData.success, true)
  assert.ok(Array.isArray(stopsData.stops))
})
