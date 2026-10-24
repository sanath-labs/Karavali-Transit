/**
 * tests/fare-and-sort.test.js
 * Unit test suite for Coastal Karnataka Fare Estimator & Multi-Criteria Bus Sorting
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateEstimatedFare, sortBuses } from '../src/fareRules.js'

test('Fare estimation for Express and Ordinary services across NH-66 corridor stops', () => {
  const expressBus = { service_type: 'Express', destination: 'Surathkal' }
  const cityBus = { service_type: 'City / Ordinary', destination: 'Surathkal' }

  // Surathkal
  assert.equal(calculateEstimatedFare(expressBus, 'Surathkal'), 35, 'Express fare to Surathkal should be ₹35')
  assert.equal(calculateEstimatedFare(cityBus, 'Surathkal'), 25, 'Ordinary fare to Surathkal should be ₹25')

  // Udupi
  assert.equal(calculateEstimatedFare(expressBus, 'Udupi'), 95, 'Express fare to Udupi should be ₹95')
  assert.equal(calculateEstimatedFare(cityBus, 'Udupi'), 75, 'Ordinary fare to Udupi should be ₹75')

  // Kuloor
  assert.equal(calculateEstimatedFare(expressBus, 'Kuloor'), 20, 'Express fare to Kuloor should be ₹20')
  assert.equal(calculateEstimatedFare(cityBus, 'Kuloor'), 15, 'Ordinary fare to Kuloor should be ₹15')

  // Default / unlisted
  assert.equal(calculateEstimatedFare(expressBus, 'Unknown'), 30, 'Default express fare should be ₹30')
  assert.equal(calculateEstimatedFare(cityBus, 'Unknown'), 20, 'Default ordinary fare should be ₹20')
})

test('Multi-criteria bus sorting by ETA (earliest arriving bus first)', () => {
  const buses = [
    { bus_id: 1, bus_name: 'Bus A', eta_minutes: 8 },
    { bus_id: 2, bus_name: 'Bus B', eta_minutes: 2 },
    { bus_id: 3, bus_name: 'Bus C', eta_minutes: 5 },
  ]

  const sorted = sortBuses(buses, 'eta')
  assert.equal(sorted[0].bus_id, 2, 'First bus should have lowest ETA (2 mins)')
  assert.equal(sorted[1].bus_id, 3, 'Second bus should have 5 mins ETA')
  assert.equal(sorted[2].bus_id, 1, 'Third bus should have 8 mins ETA')
})

test('Multi-criteria bus sorting by Fare (cheapest first)', () => {
  const buses = [
    { bus_id: 1, bus_name: 'Express 1', service_type: 'Express', destination: 'Surathkal' }, // ₹35
    { bus_id: 2, bus_name: 'City 1', service_type: 'City', destination: 'Surathkal' },       // ₹25
  ]

  const sorted = sortBuses(buses, 'fare', 'Surathkal')
  assert.equal(sorted[0].bus_id, 2, 'Cheapest bus should be Ordinary (₹25)')
  assert.equal(sorted[1].bus_id, 1, 'Second bus should be Express (₹35)')
})

test('Multi-criteria bus sorting by Seat Availability (most seats first)', () => {
  const buses = [
    { bus_id: 1, bus_name: 'Bus Overcrowded', crowd_status: 'Overcrowded' },
    { bus_id: 2, bus_name: 'Bus Standing', crowd_status: 'Standing Allowed' },
    { bus_id: 3, bus_name: 'Bus Seats', crowd_status: 'Seats Available' },
  ]

  const sorted = sortBuses(buses, 'seats')
  assert.equal(sorted[0].bus_id, 3, 'First bus should have Seats Available')
  assert.equal(sorted[1].bus_id, 2, 'Second bus should have Standing Allowed')
  assert.equal(sorted[2].bus_id, 1, 'Third bus should be Overcrowded')
})
