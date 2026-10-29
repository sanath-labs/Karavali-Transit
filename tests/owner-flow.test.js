import test from 'node:test'
import assert from 'node:assert/strict'
import {
  initDB,
  saveBus,
  getBusesByOwner,
  getBusRouteStops,
  saveConductor,
  getConductorsByOwner,
  insertOwnerActivity,
  getOwnerDashboardData,
  createOwner,
  getOwnerByEmail,
} from '../db.js'

test('Owner Registration & Authentication: DB persistence and retrieval', async () => {
  await initDB()
  const testEmail = `rakesh_test_${Date.now()}@gmail.com`
  const agencyName = 'Rakesh Coastal Logistics'

  const created = await createOwner(testEmail, agencyName)
  assert.equal(created, true)

  const owner = await getOwnerByEmail(testEmail)
  assert.ok(owner)
  assert.equal(owner.email, testEmail)
  assert.equal(owner.agency_name, agencyName)
})

test('Bus Registration Wizard: 4-step data persistence with route stops and schedule', async () => {
  await initDB()
  const testEmail = `owner_wizard_${Date.now()}@gmail.com`
  await createOwner(testEmail, 'Shri Durga Travels')

  const busPayload = {
    bus_name: 'Shri Durga Prasad',
    vehicle_number: `KA-19-AB-${Math.floor(1000 + Math.random() * 9000)}`,
    route_number: '001',
    service_type: 'Non AC',
    origin: 'Mangaluru',
    destination: 'Udupi',
    total_seats: 45,
    photo_url: '/images/coastal-private-bus.jpg',
    departure_time: '06:30 AM',
    frequency: 'Daily',
    journey_duration: '3 hours 30 minutes',
    conductor_pin: '4509',
    owner_email: testEmail,
    stops: [
      { stop_name: 'Mangaluru', planned_arrival: '06:30 AM' },
      { stop_name: 'Surathkal', planned_arrival: '07:05 AM' },
      { stop_name: 'Kundapura', planned_arrival: '09:00 AM' },
      { stop_name: 'Udupi', planned_arrival: '10:00 AM' },
    ],
  }

  const saved = await saveBus(busPayload)
  assert.ok(saved, 'Bus should be saved in DB')
  assert.ok(saved.bus_id, 'Bus should have an ID')
  assert.equal(saved.bus_name, 'Shri Durga Prasad')
  assert.equal(saved.total_seats, 45)
  assert.equal(saved.service_type, 'Non AC')
  assert.equal(saved.departure_time, '06:30 AM')
  assert.equal(saved.journey_duration, '3 hours 30 minutes')

  // Stops verification
  const stops = await getBusRouteStops(saved.bus_id)
  assert.equal(stops.length, 4)
  assert.equal(stops[0].stop_name, 'Mangaluru')
  assert.equal(stops[0].planned_arrival, '06:30 AM')
  assert.equal(stops[3].stop_name, 'Udupi')
  assert.equal(stops[3].planned_arrival, '10:00 AM')

  // Verify NO fare/fee field is stored or required
  assert.equal(saved.fare, undefined)
  assert.equal(saved.ticket_price, undefined)

  // Verify owner isolation
  const ownerBuses = await getBusesByOwner(testEmail)
  assert.equal(ownerBuses.length, 1)
  assert.equal(ownerBuses[0].bus_name, 'Shri Durga Prasad')
  assert.equal(ownerBuses[0].stops.length, 4)
})

test('Owner Conductor Management and Dashboard KPIs integration', async () => {
  await initDB()
  const testEmail = `fleet_${Date.now()}@gmail.com`
  await createOwner(testEmail, 'Karavali Fleet')

  // Add a conductor
  const conductor = await saveConductor({
    owner_email: testEmail,
    name: 'Manjunath',
    phone: '98451 12345',
    assigned_bus_id: null,
  })
  assert.ok(conductor)
  assert.ok(conductor.conductor_id)

  const conductors = await getConductorsByOwner(testEmail)
  assert.equal(conductors.length, 1)
  assert.equal(conductors[0].name, 'Manjunath')

  // Add activity
  await insertOwnerActivity(testEmail, 'conductor_assigned', 'Conductor Manjunath assigned')

  // Dashboard Data
  const dashboard = await getOwnerDashboardData(testEmail, {})
  assert.equal(dashboard.stats.total_buses, 0)
  assert.equal(dashboard.stats.total_conductors, 1)
  assert.ok(dashboard.recent_activity.length >= 1)
  assert.equal(dashboard.recent_activity[0].title, 'Conductor Manjunath assigned')
})
