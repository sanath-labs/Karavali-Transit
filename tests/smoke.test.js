/**
 * tests/smoke.test.js
 * Automated smoke tests for Karavali-Transit database and API contracts.
 */
import assert from 'node:assert/strict'
import { initDB, getBuses, recordTelemetry, getRecentTelemetry } from '../db.js'

async function runSmokeTests() {
  console.log('🧪 Starting Karavali-Transit smoke tests...')

  // 1. Database initialization and seed check
  await initDB()
  const buses = await getBuses()
  assert.ok(buses.length >= 1, 'Should have at least 1 registered coastal bus')
  console.log(`✅ [1/2] Registered buses retrieved: ${buses.length} (Sample: ${buses[0].bus_name})`)

  // 2. Telemetry insertion and query check
  const insertId = await recordTelemetry({
    bus_id: 1,
    bus_name: 'Vishal Express',
    latitude: 12.8718,
    longitude: 74.8430,
    speed: 36,
    delay_minutes: 0,
  })
  assert.ok(insertId > 0, 'Should return a valid telemetry log_id')

  const recent = await getRecentTelemetry(5)
  assert.ok(recent.length > 0, 'Should retrieve recent telemetry entries')
  console.log(`✅ [2/2] Telemetry inserted and queried successfully (Log ID: ${insertId})`)

  console.log('🎉 All smoke tests passed successfully!')
  process.exit(0)
}

runSmokeTests().catch((err) => {
  console.error('❌ Smoke test failed:', err)
  process.exit(1)
})

