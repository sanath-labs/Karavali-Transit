import test from 'node:test'
import assert from 'node:assert/strict'
import { OFFICIAL_9_CORRIDOR_STOPS } from '../src/transitUtils.js'
import { initDB, searchBusesByJourney } from '../db.js'

test('Website-Wide UI/UX & Corridor Integrity Suite', async (t) => {
  await initDB()

  await t.test('1. Strictly exactly 9 official corridor stops in fixed sequential order', () => {
    assert.equal(OFFICIAL_9_CORRIDOR_STOPS.length, 9, 'Must contain exactly 9 stops')
    const expectedOrder = [
      'Mangaluru',
      'Kuntikana',
      'Kulur',
      'Surathkal',
      'Mulki',
      'Padubidri',
      'Kaup',
      'Udupi',
      'Kundapura',
    ]

    OFFICIAL_9_CORRIDOR_STOPS.forEach((stop, idx) => {
      assert.equal(stop.stop_name, expectedOrder[idx], `Stop #${idx + 1} must be ${expectedOrder[idx]}`)
      assert.equal(stop.stop_id, idx + 1, `Stop ID must match sequence index ${idx + 1}`)
      assert.ok(stop.stop_name_kn, 'Kannada name must be present')
      assert.ok(stop.nearby_landmarks, 'Landmarks must be present')
      assert.ok(stop.latitude && stop.longitude, 'Coordinates must be valid numbers')
    })
  })

  await t.test('2. CRITICAL - Zero ticket fare, price, or booking properties in bus payload', async () => {
    const buses = await searchBusesByJourney('Surathkal', 'Udupi')
    for (const b of buses) {
      assert.equal(b.fare, undefined, 'Must not expose fare')
      assert.equal(b.ticket_fare, undefined, 'Must not expose ticket_fare')
      assert.equal(b.ticket_price, undefined, 'Must not expose ticket_price')
      assert.equal(b.price, undefined, 'Must not expose price')
      assert.equal(b.est_fare, undefined, 'Must not expose est_fare')
    }
  })

  await t.test('3. Forward journey acceptance and reverse journey rejection', async () => {
    const forward = await searchBusesByJourney('Surathkal', 'Udupi')
    assert.ok(forward.length > 0, 'Forward journey Surathkal -> Udupi must return buses')

    const reverse = await searchBusesByJourney('Udupi', 'Surathkal')
    assert.equal(reverse.length, 0, 'Reverse journey Udupi -> Surathkal must be rejected for Northbound corridor')
  })
})
