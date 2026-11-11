import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesDestination } from '../src/transitUtils.js'

test('Destination filter matches only buses travelling to the selected stop', () => {
  const northbound = {
    origin: 'Mangaluru Statebank',
    destination: 'Surathkal',
    route_name: 'Mangaluru Statebank ➔ Surathkal',
  }
  const southbound = {
    origin: 'Surathkal',
    destination: 'Mangaluru Statebank',
    route_name: 'Surathkal ➔ Mangaluru Statebank',
  }

  assert.equal(matchesDestination(northbound, 'Surathkal'), true)
  assert.equal(matchesDestination(southbound, 'Surathkal'), false)
  assert.equal(matchesDestination(southbound, 'Statebank'), true)
  assert.equal(matchesDestination(southbound, 'All'), true)
})
