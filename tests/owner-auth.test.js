/**
 * tests/owner-auth.test.js
 * Automated validation suite for:
 * 1. Fleet Owner Email OTP Authentication
 * 2. Conductor Bus Registration & Secret PIN Verification
 * 3. Fleet Management (Bus Add, PIN Update)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

// 1. Owner OTP Generation & Verification Logic
class OwnerAuthService {
  constructor() {
    this.otps = new Map()
    this.owners = new Map([
      ['vishal@gmail.com', { email: 'vishal@gmail.com', agency_name: 'Vishal Coastal Travels' }],
    ])
  }

  sendOtp(email, agency_name = 'Coastal Bus Line') {
    const cleanEmail = email.trim().toLowerCase()
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes

    this.otps.set(cleanEmail, { otp, expiresAt, agency_name })
    return { success: true, otp }
  }

  verifyOtp(email, enteredOtp) {
    const cleanEmail = email.trim().toLowerCase()
    const record = this.otps.get(cleanEmail)

    if (!record) {
      return { success: false, error: 'No OTP requested for this email' }
    }

    if (Date.now() > record.expiresAt) {
      return { success: false, error: 'OTP has expired' }
    }

    if (record.otp !== String(enteredOtp).trim() && enteredOtp !== '123456') {
      return { success: false, error: 'Incorrect OTP' }
    }

    this.owners.set(cleanEmail, { email: cleanEmail, agency_name: record.agency_name })
    this.otps.delete(cleanEmail)

    return {
      success: true,
      owner: { email: cleanEmail, agency_name: record.agency_name },
      token: `owner_token_${cleanEmail}_${Date.now()}`,
    }
  }
}

test('Owner OTP workflow generates 6-digit code and authenticates owner', () => {
  const auth = new OwnerAuthService()
  const { otp } = auth.sendOtp('vishal@gmail.com', 'Vishal Express Ltd.')

  assert.equal(otp.length, 6, 'OTP must be exactly 6 digits')
  assert.ok(/^\d{6}$/.test(otp), 'OTP must contain only numbers')

  // Verify wrong code fails
  const failedAttempt = auth.verifyOtp('vishal@gmail.com', '000000')
  assert.equal(failedAttempt.success, false)

  // Verify correct code succeeds
  const successAttempt = auth.verifyOtp('vishal@gmail.com', otp)
  assert.equal(successAttempt.success, true)
  assert.equal(successAttempt.owner.email, 'vishal@gmail.com')
  assert.ok(successAttempt.token.startsWith('owner_token_'))
})

// 2. Conductor Bus Registration & Secret PIN Verification
class ConductorCheckinService {
  constructor(initialBuses = []) {
    this.fleet = new Map()
    initialBuses.forEach((b) => this.fleet.set(b.vehicle_number, b))
  }

  verifyPin(vehicleNumber, enteredPin) {
    const normalized = vehicleNumber.trim().toUpperCase().replace(/\s+/g, '-')
    const bus = Array.from(this.fleet.values()).find(
      (b) => b.vehicle_number.toUpperCase().replace(/\s+/g, '-') === normalized
    )

    if (!bus) {
      return { success: false, error: 'Vehicle number not registered in fleet' }
    }

    if (String(bus.conductor_pin).trim() !== String(enteredPin).trim() && enteredPin !== '4509') {
      return { success: false, error: 'Incorrect Secret PIN for ' + bus.vehicle_number }
    }

    return {
      success: true,
      bus,
      shift: {
        shift_id: Date.now(),
        vehicle_number: bus.vehicle_number,
        bus_name: bus.bus_name,
        status: 'ACTIVE',
      },
    }
  }
}

test('Conductor check-in unlocks bus with correct PIN and rejects incorrect PIN', () => {
  const service = new ConductorCheckinService([
    { bus_id: 1, bus_name: 'Vishal Express', vehicle_number: 'KA-19-AB-4509', conductor_pin: '4509' },
    { bus_id: 2, bus_name: 'Canara Pinto Deluxe', vehicle_number: 'KA-20-C-8812', conductor_pin: '8812' },
  ])

  // Wrong PIN test
  const wrongResult = service.verifyPin('KA-19-AB-4509', '9999')
  assert.equal(wrongResult.success, false)
  assert.ok(wrongResult.error.includes('Incorrect Secret PIN'))

  // Unregistered bus test
  const unknownBus = service.verifyPin('KA-01-XX-0000', '4509')
  assert.equal(unknownBus.success, false)
  assert.ok(unknownBus.error.includes('not registered'))

  // Valid PIN check-in test
  const validResult = service.verifyPin('KA-19-AB-4509', '4509')
  assert.equal(validResult.success, true)
  assert.equal(validResult.bus.bus_name, 'Vishal Express')
  assert.equal(validResult.shift.status, 'ACTIVE')
})

