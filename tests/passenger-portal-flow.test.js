import test from 'node:test'
import assert from 'node:assert/strict'
import {
  initDB,
  searchBusStops,
  getNearbyBusStops,
  getAllBusStops,
  searchBusesByJourney,
  getBusRouteWithStops,
  savePassengerFeedback,
  getPassengerFeedback,
} from '../db.js'

test('Passenger Portal End-to-End Database and Flow Suite', async (t) => {
  await initDB()

  await t.test('1. Bus Stop Discovery - Search by Official Name in English & Kannada', async () => {
    // Exactly 9 official corridor stops
    const allStops = await getAllBusStops()
    assert.equal(allStops.length, 9, 'Should return exactly 9 official corridor stops')

    // Search in English
    const englishResults = await searchBusStops('Surathkal')
    assert.ok(englishResults.length > 0, 'Should find Surathkal stop in English')
    assert.equal(englishResults[0].stop_name, 'Surathkal')

    // Search in Kannada
    const kannadaResults = await searchBusStops('ಸುರತ್ಕಲ್')
    assert.ok(kannadaResults.length > 0, 'Should find Surathkal stop in Kannada')
    assert.equal(kannadaResults[0].stop_name, 'Surathkal')

    // Search partial name
    const partialResults = await searchBusStops('Surath')
    assert.ok(partialResults.length > 0, 'Should find Surathkal by partial match')
    assert.ok(partialResults.some((s) => s.stop_name === 'Surathkal'), 'Surathkal should be in partial match results')

    // Search Hampankatta alternative name -> maps to Mangaluru
    const hampanResults = await searchBusStops('Hampan')
    assert.ok(hampanResults.some((s) => s.stop_name === 'Mangaluru'), 'Hampankatta should map to official Mangaluru stop')
  })

  await t.test('2. Bus Stop Discovery - Search by Familiar Nearby Landmarks', async () => {
    // Landmark: AJ Hospital
    const hospitalResults = await searchBusStops('AJ Hospital')
    assert.ok(hospitalResults.length > 0, 'Should find matching stop for AJ Hospital landmark')
    const ajStop = hospitalResults.find((s) => s.stop_name === 'Kuntikana')
    assert.ok(ajStop, 'AJ Hospital should map to official Kuntikana stop')
    assert.ok(ajStop.nearby_landmarks.includes('AJ Hospital'), 'Landmark details should mention AJ Hospital')

    // Landmark: NITK
    const collegeResults = await searchBusStops('NITK')
    assert.ok(collegeResults.length > 0, 'Should find matching stop for NITK landmark')
    assert.equal(collegeResults[0].stop_name, 'Surathkal')

    // Landmark: Sri Krishna Matha Temple
    const templeResults = await searchBusStops('Sri Krishna Matha')
    assert.ok(templeResults.length > 0, 'Should find matching stop for Sri Krishna Matha landmark')
    assert.equal(templeResults[0].stop_name, 'Udupi')
  })

  await t.test('3. Bus Stop Discovery - Optional Nearby Stops with Coordinates (Haversine)', async () => {
    // Coordinates near Surathkal (NITK): 13.0068, 74.7954
    const nearby = await getNearbyBusStops(13.0068, 74.7954, 15)
    assert.ok(nearby.length > 0, 'Should find nearby stops within 15 km')
    assert.equal(nearby[0].stop_name, 'Surathkal', 'Closest stop should be Surathkal')
    assert.equal(nearby[0].distance_km, 0, 'Distance to exact coordinate should be 0 km')

    // Check subsequent stops are sorted ascending by distance
    for (let i = 1; i < nearby.length; i++) {
      assert.ok(nearby[i].distance_km >= nearby[i - 1].distance_km, 'Stops must be ordered by distance')
    }
  })

  await t.test('4. Journey Search - Stop Order Matching (FROM occurs BEFORE TO)', async () => {
    // Search Mangaluru -> Kundapura
    const buses = await searchBusesByJourney('Mangaluru', 'Kundapura')
    assert.equal(buses.length, 3, 'Should find all 3 coastal buses operating from Mangaluru to Kundapura')

    const firstBus = buses[0]
    assert.ok(firstBus.bus_name, 'Bus name must be present')
    assert.ok(firstBus.vehicle_number, 'Vehicle registration number must be present')
    assert.equal(firstBus.boarding_stop, 'Mangaluru')
    assert.equal(firstBus.destination_stop, 'Kundapura')
    assert.ok(firstBus.boarding_stop_order < firstBus.destination_stop_order, 'Boarding order must precede destination order')
    assert.ok(firstBus.conductor_name, 'Conductor name must be present')

    // Reverse Search: Kundapura -> Mangaluru should NOT match forward buses where Mangaluru precedes Kundapura
    const reverseBuses = await searchBusesByJourney('Kundapura', 'Mangaluru')
    assert.equal(reverseBuses.length, 0, 'Reverse search must reject buses travelling in opposite direction')
  })

  await t.test('5. Bus Route Details - Vertical Timeline with All 9 Official Stops', async () => {
    const buses = await searchBusesByJourney('Surathkal', 'Udupi')
    assert.ok(buses.length > 0)
    const busId = buses[0].bus_id

    const routeData = await getBusRouteWithStops(busId)
    assert.ok(routeData, 'Bus route data must be returned')
    assert.equal(routeData.stops.length, 9, 'Route must contain all 9 official corridor stops in order')

    const hasLandmarks = routeData.stops.some((s) => s.nearby_landmarks && s.nearby_landmarks.length > 0)
    assert.ok(hasLandmarks, 'Route stops should be enriched with verified nearby landmarks')
  })

  await t.test('6. CRITICAL REQUIREMENT - Zero Ticket Fare, Price, or Fee Properties', async () => {
    const buses = await searchBusesByJourney('Surathkal', 'Udupi')
    assert.ok(buses.length > 0)

    for (const bus of buses) {
      assert.equal(bus.fare, undefined, 'Bus must not expose fare property')
      assert.equal(bus.ticket_fare, undefined, 'Bus must not expose ticket_fare property')
      assert.equal(bus.ticket_price, undefined, 'Bus must not expose ticket_price property')
      assert.equal(bus.price, undefined, 'Bus must not expose price property')
      assert.equal(bus.est_fare, undefined, 'Bus must not expose est_fare property')
      assert.equal(bus.stage_fare, undefined, 'Bus must not expose stage_fare property')
      assert.equal(bus.conductor_pin, undefined, 'Bus must not expose secret conductor PIN')
      assert.equal(bus.owner_email, undefined, 'Bus must not expose owner email address')
    }
  })

  await t.test('7. Passenger Feedback - Persistence in PostgreSQL / SQLite', async () => {
    const feedbackPayload = {
      name: 'Priya Rao',
      email: 'priya@example.com',
      category: 'Punctuality',
      rating: 5,
      message: 'Excellent real-time tracking for the Udupi Express on NH-66 corridor.',
    }

    const saved = await savePassengerFeedback(feedbackPayload)
    assert.ok(saved.id, 'Feedback ID should be generated upon insert')
    assert.equal(saved.name, 'Priya Rao')
    assert.equal(saved.rating, 5)

    const list = await getPassengerFeedback(10)
    assert.ok(list.length > 0, 'Recent feedback should be queryable')
    const match = list.find((item) => item.id === saved.id)
    assert.ok(match, 'Saved feedback must exist in the database list')
  })

  await t.test('8. Filter Verification - Active, All, Scheduled Bus Breakdown', async () => {
    const allCorridorBuses = await searchBusesByJourney('Surathkal', 'Udupi')
    assert.equal(allCorridorBuses.length, 3, 'Should find all 3 registered buses on corridor')

    // Simulate active shift telemetry for Durga and Lakshmi
    const bus1 = allCorridorBuses.find((b) => b.bus_name.includes('Durga'))
    const bus2 = allCorridorBuses.find((b) => b.bus_name.includes('Lakshmi'))
    const activeMap = {}
    if (bus1) activeMap[bus1.bus_id] = { is_on_shift: true, latitude: 13.165, longitude: 74.76, speed: 42, timestamp: Date.now() }
    if (bus2) activeMap[bus2.bus_id] = { is_on_shift: true, latitude: 13.045, longitude: 74.789, speed: 38, timestamp: Date.now() }

    const busesWithTelemetry = await searchBusesByJourney('Surathkal', 'Udupi', activeMap)
    const activeBuses = busesWithTelemetry.filter((b) => b.is_live || b.tracking_status === 'LIVE' || b.tracking_status === 'LOCATION STALE')
    const scheduledBuses = busesWithTelemetry.filter((b) => b.tracking_status === 'SCHEDULED' || (!b.is_live && b.tracking_status !== 'LIVE' && b.tracking_status !== 'LOCATION STALE'))

    assert.equal(activeBuses.length, 2, 'Should have exactly 2 active live buses on shift (Shri Durga & Sri Lakshmi)')
    assert.equal(scheduledBuses.length, 1, 'Should have exactly 1 scheduled bus (Udupi Express)')
  })
})
