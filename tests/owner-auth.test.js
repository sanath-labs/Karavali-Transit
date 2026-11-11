import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOwnerSessionManager,
  isValidOtp,
  matchesConductorPin,
  toPublicBus,
} from '../serverAuth.js'

test('Owner OTP validation requires a matching, unexpired code and limits attempts', () => {
  const record = { otp: '735914', expiresAt: 2000, attempts: 0 }

  assert.equal(isValidOtp(record, '735914', 1000), true)
  assert.equal(isValidOtp(record, '123456', 1000), false)
  assert.equal(isValidOtp(record, '735914', 2000), false)
  assert.equal(isValidOtp({ ...record, attempts: 5 }, '735914', 1000), false)
})

test('Owner sessions are random bearer tokens and expire after twelve hours', () => {
  const manager = createOwnerSessionManager()
  const firstToken = manager.create('owner@example.com', 'Coastal Transit', 1000)
  const secondToken = manager.create('owner@example.com', 'Coastal Transit', 1000)

  assert.match(firstToken, /^[a-f0-9]{64}$/)
  assert.notEqual(firstToken, secondToken)
  assert.equal(manager.get(firstToken, 1001).email, 'owner@example.com')
  assert.equal(manager.get(firstToken, 1000 + 12 * 60 * 60 * 1000), null)
})

test('Conductor PIN verification accepts only the registered bus PIN', () => {
  assert.equal(matchesConductorPin('8812', '8812'), true)
  assert.equal(matchesConductorPin('8812', '4509'), false)
  assert.equal(matchesConductorPin('', '4509'), false)
})

test('Public bus payload omits conductor PIN', () => {
  const publicBus = toPublicBus({
    bus_id: 1,
    conductor_pin: '8812',
    owner_email: 'owner@example.com',
    bus_name: 'Coastal Express',
  })

  assert.deepEqual(publicBus, { bus_id: 1, bus_name: 'Coastal Express' })
})
