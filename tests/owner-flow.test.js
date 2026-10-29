import test from 'node:test'
import assert from 'node:assert/strict'
import {
  initDB,
  saveBus,
  getBusesByOwner,
  getBusRouteStops,
  getBusByVehicleNumber,
  verifyConductorPin,
  saveConductor,
  getConductorsByOwner,
  insertOwnerActivity,
  getOwnerDashboardData,
  createOwner,
  getOwnerByEmail,
} from '../db.js'
import { matchesDestination } from '../src/transitUtils.js'

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

test('Multi-Bus Registration & Listing: Register multiple buses under same owner', async () => {
  await initDB()
  const testEmail = `multi_bus_${Date.now()}@gmail.com`
  await createOwner(testEmail, 'Canara Express Lines')

  // Bus 1
  const bus1 = await saveBus({
    bus_name: 'Canara Express 1',
    vehicle_number: `KA-19-MB-${Math.floor(1000 + Math.random() * 9000)}`,
    route_number: '101',
    service_type: 'Express',
    origin: 'Mangaluru',
    destination: 'Udupi',
    total_seats: 50,
    departure_time: '07:00 AM',
    frequency: 'Daily',
    journey_duration: '2 hours',
    conductor_pin: '1234',
    owner_email: testEmail,
    stops: [
      { stop_name: 'Mangaluru', planned_arrival: '07:00 AM' },
      { stop_name: 'Surathkal', planned_arrival: '07:35 AM' },
      { stop_name: 'Mulki', planned_arrival: '08:00 AM' },
      { stop_name: 'Udupi', planned_arrival: '09:00 AM' },
    ],
  })
  assert.ok(bus1?.bus_id)

  // Bus 2
  const bus2 = await saveBus({
    bus_name: 'Canara Superfast 2',
    vehicle_number: `KA-20-MB-${Math.floor(1000 + Math.random() * 9000)}`,
    route_number: '102',
    service_type: 'Non AC',
    origin: 'Udupi',
    destination: 'Kundapura',
    total_seats: 40,
    departure_time: '10:00 AM',
    frequency: 'Hourly',
    journey_duration: '1 hour 15 minutes',
    conductor_pin: '5678',
    owner_email: testEmail,
    stops: [
      { stop_name: 'Udupi', planned_arrival: '10:00 AM' },
      { stop_name: 'Brahmavara', planned_arrival: '10:30 AM' },
      { stop_name: 'Kundapura', planned_arrival: '11:15 AM' },
    ],
  })
  assert.ok(bus2?.bus_id)

  // Retrieve list of buses for this owner
  const buses = await getBusesByOwner(testEmail)
  assert.equal(buses.length, 2, 'Owner should have both registered buses')
  assert.equal(buses[0].bus_name, 'Canara Express 1')
  assert.equal(buses[1].bus_name, 'Canara Superfast 2')
  assert.equal(buses[0].total_seats, 50)
  assert.equal(buses[1].total_seats, 40)
  assert.equal(buses[0].stops.length, 4)
  assert.equal(buses[1].stops.length, 3)

  // Intermediate stop match in passenger radar
  assert.equal(matchesDestination(buses[0], 'Mulki'), true)
  assert.equal(matchesDestination(buses[0], 'Surathkal'), true)
  assert.equal(matchesDestination(buses[1], 'Brahmavara'), true)
  assert.equal(matchesDestination(buses[1], 'Bengaluru'), false)

  // Dashboard stats reflect both buses and 2 distinct routes
  const dashboard = await getOwnerDashboardData(testEmail, {
    [bus1.bus_id]: { speed: 35, is_on_shift: true },
  })
  assert.equal(dashboard.stats.total_buses, 2)
  assert.equal(dashboard.stats.total_routes, 2)
  assert.equal(dashboard.stats.live_buses, 1)

  // Tracking status integration
  const bus1Record = dashboard.buses.find((b) => b.bus_id === bus1.bus_id)
  const bus2Record = dashboard.buses.find((b) => b.bus_id === bus2.bus_id)
  assert.equal(bus1Record.is_live, true)
  assert.equal(bus1Record.tracking_status, 'Live On Shift')
  assert.equal(bus2Record.is_live, false)
  assert.equal(bus2Record.tracking_status, 'Offline / Not Started')

  // Conductor Secret PIN verification for newly registered buses
  const pinOk = await verifyConductorPin(bus1.vehicle_number, '1234')
  assert.equal(pinOk.success, true)
  assert.equal(pinOk.bus.bus_name, 'Canara Express 1')

  const pinBad = await verifyConductorPin(bus1.vehicle_number, '9999')
  assert.equal(pinBad.success, false)

  // Vehicle duplicate check helper
  const found = await getBusByVehicleNumber(bus1.vehicle_number)
  assert.ok(found)
  assert.equal(found.bus_id, bus1.bus_id)
})


