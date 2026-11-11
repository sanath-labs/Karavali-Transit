import { randomBytes } from 'node:crypto'

const OWNER_SESSION_TTL_MS = 12 * 60 * 60 * 1000
const CONDUCTOR_SESSION_TTL_MS = 12 * 60 * 60 * 1000

export function createOwnerSessionManager() {
  const sessions = new Map()

  return {
    create(email, agencyName, now = Date.now()) {
      const token = randomBytes(32).toString('hex')
      sessions.set(token, {
        email,
        agency_name: agencyName,
        expires_at: now + OWNER_SESSION_TTL_MS,
      })
      return token
    },
    set(token, sessionData) {
      sessions.set(token, sessionData)
    },
    get(token, now = Date.now()) {
      const session = sessions.get(token)
      if (!session) return null
      if (session.expires_at <= now) {
        sessions.delete(token)
        return null
      }
      return session
    },
    delete(token) {
      sessions.delete(token)
    },
  }
}

export function createConductorSessionManager() {
  const sessions = new Map()

  return {
    create(conductorId, phone, ownerEmail, busId, now = Date.now()) {
      const token = randomBytes(32).toString('hex')
      sessions.set(token, {
        conductor_id: conductorId ? Number(conductorId) : null,
        phone: String(phone || '').trim(),
        owner_email: String(ownerEmail || '').trim().toLowerCase(),
        bus_id: busId ? Number(busId) : null,
        created_at: now,
        expires_at: now + CONDUCTOR_SESSION_TTL_MS,
      })
      return token
    },
    set(token, sessionData) {
      sessions.set(token, sessionData)
    },
    get(token, now = Date.now()) {
      const session = sessions.get(token)
      if (!session) return null
      if (session.expires_at <= now) {
        sessions.delete(token)
        return null
      }
      return session
    },
    delete(token) {
      sessions.delete(token)
    },
    updateBus(token, busId) {
      const session = sessions.get(token)
      if (session) {
        session.bus_id = busId ? Number(busId) : null
      }
    },
  }
}

export function isValidOtp(record, enteredOtp, now = Date.now()) {
  return Boolean(
    record &&
      record.expiresAt > now &&
      record.attempts < 5 &&
      record.otp === String(enteredOtp).trim()
  )
}

export function matchesConductorPin(expectedPin, enteredPin) {
  const expected = String(expectedPin || '').trim()
  return expected !== '' && expected === String(enteredPin || '').trim()
}

export function toPublicBus(bus) {
  if (!bus) return null
  const publicBus = { ...bus }
  delete publicBus.conductor_pin
  delete publicBus.owner_email
  delete publicBus.driver_phone
  delete publicBus.fare
  delete publicBus.ticket_fare
  delete publicBus.ticket_price
  delete publicBus.price
  delete publicBus.est_fare
  delete publicBus.stage_fare
  return publicBus
}
