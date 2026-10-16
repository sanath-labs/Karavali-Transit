/**
 * tests/smoke.test.js
 * Automated smoke tests for Karavali-Transit database and API contracts.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../db.js'

test('Database schema initialization', () => {
  assert.ok(db, 'Database instance should be initialized')

  const buses = db.prepare('SELECT COUNT(*) as count FROM buses').get()
  assert.ok(buses.count >= 1, 'Should have at least 1 registered bus in the database')

  const testBus = db.prepare('SELECT * FROM buses WHERE id = 1').get()
  assert.equal(testBus.name, 'Vishal Express')
  assert.equal(testBus.route_name, 'Mangaluru Statebank ➔ Surathkal')
})

test('Telemetry record insertion and retrieval', () => {
  const insert = db.prepare(`
    INSERT INTO bus_telemetry (bus_id, latitude, longitude, speed, crowd_status, is_last_bus)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const result = insert.run(1, 12.8718, 74.8430, 36, 'Seats Available', 0)
  assert.ok(result.lastInsertRowid > 0, 'Should insert telemetry row successfully')

  const latest = db.prepare(`
    SELECT * FROM bus_telemetry WHERE bus_id = 1 ORDER BY id DESC LIMIT 1
  `).get()
  assert.equal(latest.latitude, 12.8718)
  assert.equal(latest.longitude, 74.8430)
  assert.equal(latest.speed, 36)
})
