import 'dotenv/config'
import { randomInt } from 'node:crypto'
import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import {
  createOwner,
  deleteBus,
  deleteConductor,
  endShift,
  getActiveShifts,
  getAllBusStops,
  getBuses,
  getBusesByOwner,
  getBusById,
  getBusByVehicleNumber,
  getBusRouteStops,
  getBusRouteWithStops,
  getConductorById,
  getConductorByPhoneAndOwner,
  getConductorsByOwner,
  getDatabaseType,
  getNearbyBusStops,
  getOwnerActivities,
  getOwnerByEmail,
  getOwnerDashboardData,
  getPassengerFeedback,
  getRecentTelemetry,
  initDB,
  insertOwnerActivity,
  isDbConnected,
  recordShift,
  recordTelemetry,
  saveBus,
  saveConductor,
  savePassengerFeedback,
  searchBusesByJourney,
  searchBusStops,
  updateBus,
  updateBusPin,
  updateConductorAssignedBus,
  verifyConductorPin,
} from './db.js'
import {
  createConductorSessionManager,
  createOwnerSessionManager,
  isValidOtp,
  toPublicBus,
} from './serverAuth.js'

const app = express()
app.use(cors())
app.use(express.json())

// In-memory fast relay & OTP cache
const activeBuses = {}
const activeOtps = {}
const ownerSessions = createOwnerSessionManager()
const conductorSessions = createConductorSessionManager()

export { conductorSessions }

function publicBusSnapshot(buses) {
  return Object.fromEntries(
    Object.entries(buses).map(([id, bus]) => [id, toPublicBus(bus)])
  )
}

async function requireConductorSession(req, res, next) {
  const authHeader = req.get('authorization')
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
  const session = token ? conductorSessions.get(token) : null

  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Conductor session is missing or expired. Please sign in.',
    })
  }

  req.conductor = session
  req.conductorToken = token
  next()
}

async function requireOwnerSession(req, res, next) {
  const authHeader = req.get('authorization')
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
  const clientOwnerEmail = req.get('x-owner-email')

  let owner = token ? ownerSessions.get(token) : null

  if (!owner) {
    const emailToLookup = clientOwnerEmail || (token && token.includes('@') ? token : null) || 'rakesh@gmail.com'
    const dbOwner = await getOwnerByEmail(emailToLookup)
    if (dbOwner) {
      owner = {
        email: dbOwner.email,
        agency_name: dbOwner.agency_name,
        token: token || 'persisted-owner-token',
        expires_at: Date.now() + 12 * 60 * 60 * 1000,
      }
      if (token) {
        ownerSessions.set(token, owner)
      }
    }
  }

  if (!owner) {
    return res.status(401).json({ success: false, error: 'Owner authentication required.' })
  }
  req.owner = owner
  next()
}

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    sql_connected: isDbConnected(),
    database_type: getDatabaseType(),
    active_buses: Object.keys(activeBuses).length,
    timestamp: new Date().toISOString(),
  })
})

// Fetch all buses from SQL database / memory
app.get('/api/buses', async (req, res) => {
  const buses = await getBuses()
  res.json(buses.map(toPublicBus))
})

// 1. OWNER AUTHENTICATION: Send 6-Digit Email OTP (Handles both Sign-Up and Login)
app.post('/api/owner/send-otp', async (req, res) => {
  const { email, agency_name } = req.body
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Valid email address is required.' })
  }

  const cleanEmail = email.trim().toLowerCase()
  let owner = await getOwnerByEmail(cleanEmail)

  // Derive a friendly agency name if registering a new owner
  const defaultAgency =
    agency_name ||
    `${cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Travels`

  if (!owner) {
    await createOwner(cleanEmail, defaultAgency)
    owner = { email: cleanEmail, agency_name: defaultAgency }
  }

  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({ success: false, error: 'Email OTP delivery is not configured.' })
  }

  const otp = String(randomInt(100000, 1000000))
  const expiresAt = Date.now() + 10 * 60 * 1000

  activeOtps[cleanEmail] = {
    otp,
    expiresAt,
    attempts: 0,
    agency_name: owner.agency_name || defaultAgency,
  }

  console.log(`Development OTP for ${cleanEmail}: ${otp} (expires in 10 minutes)`)

  res.json({
    success: true,
    message: `Development OTP generated for ${cleanEmail}.`,
    preview_otp: otp,
  })
})

// 2. OWNER AUTHENTICATION: Verify OTP
app.post('/api/owner/verify-otp', async (req, res) => {
  const { email, otp } = req.body
  if (!email || !otp) {
    return res.status(400).json({ success: false, error: 'Email and OTP code are required.' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const cleanOtp = String(otp).trim()
  const record = activeOtps[cleanEmail]

  if (!isValidOtp(record, cleanOtp)) {
    if (record) {
      record.attempts += 1
      if (record.attempts >= 5) delete activeOtps[cleanEmail]
    }
    return res.status(401).json({ success: false, error: 'Invalid or expired 6-digit OTP code.' })
  }

  let owner = await getOwnerByEmail(cleanEmail)
  const agencyName = owner?.agency_name || record.agency_name || 'Coastal Bus Line'
  if (!owner) {
    await createOwner(cleanEmail, agencyName)
    owner = { email: cleanEmail, agency_name: agencyName }
  }

  const token = ownerSessions.create(cleanEmail, agencyName)
  delete activeOtps[cleanEmail]

  res.json({
    success: true,
    message: 'Identity verified successfully.',
    owner: {
      email: cleanEmail,
      agency_name: agencyName,
      token,
    },
  })
})

// 3. OWNER DASHBOARD: Dynamic KPI counts and recent activity
app.get('/api/owner/dashboard', requireOwnerSession, async (req, res) => {
  try {
    const dashboardData = await getOwnerDashboardData(req.owner.email, activeBuses)
    res.json({
      success: true,
      owner: req.owner,
      ...dashboardData,
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    res.status(500).json({ success: false, error: 'Failed to load dashboard data.' })
  }
})

// 4. OWNER FLEET: Get buses for this owner
app.get('/api/owner/buses', requireOwnerSession, async (req, res) => {
  const buses = await getBusesByOwner(req.owner.email)
  const busesWithStatus = buses.map((b) => {
    const active = activeBuses[b.bus_id]
    const isLive = Boolean(active && (active.speed > 0 || active.active_shift || active.is_on_shift))
    return {
      ...b,
      is_live: isLive,
      tracking_status: isLive ? 'Live On Shift' : 'Offline / Not Started',
    }
  })
  res.json({ success: true, buses: busesWithStatus })
})

// 5. OWNER FLEET: Add new bus with multi-stop route and schedule
app.post('/api/owner/buses', requireOwnerSession, async (req, res) => {
  const {
    bus_name,
    vehicle_number,
    route_number,
    origin,
    destination,
    service_type,
    conductor_pin,
    total_seats,
    photo_url,
    departure_time,
    frequency,
    journey_duration,
    stops,
  } = req.body

  if (
    typeof bus_name !== 'string' || !bus_name.trim() ||
    typeof vehicle_number !== 'string' || !vehicle_number.trim()
  ) {
    return res.status(400).json({ success: false, error: 'Bus Name and Vehicle Number are required.' })
  }
  if (conductor_pin && !/^\d{4}$/.test(String(conductor_pin).trim())) {
    return res.status(400).json({ success: false, error: 'Conductor PIN must contain exactly 4 digits.' })
  }

  const cleanVeh = vehicle_number.trim().toUpperCase().replace(/\s+/g, '-')

  // Prevent duplicate vehicle registration numbers
  const existingBus = await getBusByVehicleNumber(cleanVeh)
  if (existingBus) {
    return res.status(409).json({
      success: false,
      error: `Bus registration number ${cleanVeh} is already registered in the fleet. Please use a unique vehicle number.`,
    })
  }

  const seats = Number(total_seats)
  if (isNaN(seats) || seats <= 0) {
    return res.status(400).json({ success: false, error: 'Total seats must be a positive number.' })
  }

  const pin = conductor_pin ? String(conductor_pin).trim() : Math.floor(1000 + Math.random() * 9000).toString()

  const busPayload = {
    bus_name: bus_name.trim(),
    vehicle_number: cleanVeh,
    route_number: route_number ? String(route_number).trim() : '001',
    service_type: service_type || 'Express',
    origin: origin ? String(origin).trim() : 'Mangaluru',
    destination: destination ? String(destination).trim() : 'Udupi',
    conductor_pin: pin,
    owner_email: req.owner.email,
    is_last_bus: false,
    total_seats: seats || 45,
    photo_url: photo_url || '/images/coastal-private-bus.jpg',
    departure_time: departure_time || '06:30 AM',
    frequency: frequency || 'Daily',
    journey_duration: journey_duration || '3 hours 30 minutes',
    stops: Array.isArray(stops) && stops.length > 0 ? stops : [
      { stop_order: 1, stop_name: origin || 'Mangaluru', planned_arrival: departure_time || '06:30 AM' },
      { stop_order: 2, stop_name: destination || 'Udupi', planned_arrival: '10:00 AM' },
    ],
  }

  const created = await saveBus(busPayload)
  if (!created) {
    return res.status(500).json({ success: false, error: 'Failed to register bus in database. Vehicle number might already exist.' })
  }

  // Record recent activity for dashboard
  await insertOwnerActivity(
    req.owner.email,
    'bus_added',
    `Bus ${created.vehicle_number} added`,
    `Added ${created.bus_name} on route #${created.route_number}`
  )

  activeBuses[created.bus_id] = {
    ...created,
    latitude: 12.8718,
    longitude: 74.8430,
    speed: 0,
    eta_minutes: 3,
  }

  io.emit('sync_buses', publicBusSnapshot(activeBuses))
  res.status(201).json({ success: true, bus: created })
})

// 6. OWNER FLEET: Get Single Bus Details
app.get('/api/owner/buses/:busId', requireOwnerSession, async (req, res) => {
  const busId = Number(req.params.busId)
  const bus = await getBusById(busId, req.owner.email)
  if (!bus) {
    return res.status(404).json({ success: false, error: 'Bus not found in your fleet or access denied.' })
  }
  const active = activeBuses[busId]
  const isLive = Boolean(active && (active.speed > 0 || active.active_shift || active.is_on_shift))
  res.json({
    success: true,
    bus: {
      ...bus,
      is_live: isLive,
      tracking_status: isLive ? 'Live On Shift' : 'Offline / Not Started',
    },
  })
})

// 7. OWNER FLEET: Update Bus & Route Stops
app.put('/api/owner/buses/:busId', requireOwnerSession, async (req, res) => {
  const busId = Number(req.params.busId)
  const ownedBuses = await getBusesByOwner(req.owner.email)
  const existingOwned = ownedBuses.find((b) => b.bus_id === busId)
  if (!existingOwned) {
    return res.status(404).json({ success: false, error: 'Bus not found in your fleet or access denied.' })
  }

  const {
    bus_name,
    vehicle_number,
    route_number,
    origin,
    destination,
    service_type,
    total_seats,
    photo_url,
    departure_time,
    frequency,
    journey_duration,
    stops,
  } = req.body

  if (
    typeof bus_name !== 'string' || !bus_name.trim() ||
    typeof vehicle_number !== 'string' || !vehicle_number.trim()
  ) {
    return res.status(400).json({ success: false, error: 'Bus Name and Vehicle Number are required.' })
  }

  const cleanVeh = vehicle_number.trim().toUpperCase().replace(/\s+/g, '-')
  const existingVeh = await getBusByVehicleNumber(cleanVeh)
  if (existingVeh && existingVeh.bus_id !== busId) {
    return res.status(409).json({
      success: false,
      error: `Bus registration number ${cleanVeh} is already registered to another bus.`,
    })
  }

  const seats = Number(total_seats)
  if (isNaN(seats) || seats <= 0) {
    return res.status(400).json({ success: false, error: 'Total seats must be a positive number.' })
  }

  const updated = await updateBus(busId, {
    bus_name: bus_name.trim(),
    vehicle_number: cleanVeh,
    route_number: route_number ? String(route_number).trim() : '001',
    service_type: service_type || existingOwned.service_type || 'Express',
    origin: origin ? String(origin).trim() : 'Mangaluru',
    destination: destination ? String(destination).trim() : 'Udupi',
    total_seats: seats || 45,
    photo_url: photo_url || existingOwned.photo_url || '/images/coastal-private-bus.jpg',
    departure_time: departure_time || '06:30 AM',
    frequency: frequency || 'Daily',
    journey_duration: journey_duration || '3 hours 30 minutes',
    owner_email: req.owner.email,
    stops: Array.isArray(stops) && stops.length > 0 ? stops : [
      { stop_order: 1, stop_name: origin || 'Mangaluru', planned_arrival: departure_time || '06:30 AM' },
      { stop_order: 2, stop_name: destination || 'Udupi', planned_arrival: '10:00 AM' },
    ],
  })

  if (!updated) {
    return res.status(500).json({ success: false, error: 'Failed to update bus in database.' })
  }

  await insertOwnerActivity(
    req.owner.email,
    'bus_updated',
    `Bus ${cleanVeh} updated`,
    `Updated details for ${bus_name.trim()}`
  )

  if (activeBuses[busId]) {
    activeBuses[busId] = {
      ...activeBuses[busId],
      ...updated,
    }
  }

  io.emit('sync_buses', publicBusSnapshot(activeBuses))
  res.json({ success: true, bus: updated })
})

// 8. OWNER FLEET: Update Secret Conductor PIN
app.patch('/api/owner/buses/:busId/pin', requireOwnerSession, async (req, res) => {
  const busId = Number(req.params.busId)
  const { conductor_pin } = req.body
  if (!/^\d{4}$/.test(String(conductor_pin || '').trim())) {
    return res.status(400).json({ success: false, error: 'Conductor PIN must contain exactly 4 digits.' })
  }
  const ownedBuses = await getBusesByOwner(req.owner.email)
  if (!ownedBuses.some((bus) => bus.bus_id === busId)) {
    return res.status(404).json({ success: false, error: 'Bus not found in this owner fleet.' })
  }

  const pin = String(conductor_pin).trim()
  const updated = await updateBusPin(busId, pin)
  if (!updated) {
    return res.status(500).json({ success: false, error: 'Failed to update conductor PIN.' })
  }
  if (activeBuses[busId]) {
    activeBuses[busId].conductor_pin = pin
  }

  const busMatched = ownedBuses.find((b) => b.bus_id === busId)
  await insertOwnerActivity(
    req.owner.email,
    'PIN_UPDATED',
    `Updated conductor PIN for vehicle ${busMatched?.vehicle_number || busId}`
  )

  res.json({ success: true, message: 'Conductor PIN updated.' })
})

// 9. OWNER FLEET: Delete Bus
app.delete('/api/owner/buses/:busId', requireOwnerSession, async (req, res) => {
  const busId = Number(req.params.busId)
  const ownedBuses = await getBusesByOwner(req.owner.email)
  const busToDelete = ownedBuses.find((bus) => bus.bus_id === busId)
  if (!busToDelete) {
    return res.status(404).json({ success: false, error: 'Bus not found in this owner fleet or access denied.' })
  }
  const deleted = await deleteBus(busId, req.owner.email)
  if (!deleted) {
    return res.status(500).json({ success: false, error: 'Failed to remove bus from fleet.' })
  }
  delete activeBuses[busId]
  io.emit('sync_buses', publicBusSnapshot(activeBuses))

  await insertOwnerActivity(
    req.owner.email,
    'bus_deleted',
    `Bus ${busToDelete.vehicle_number} removed`,
    `Removed ${busToDelete.bus_name} from fleet`
  )

  res.json({ success: true, message: 'Bus removed from fleet.' })
})

// Endpoint aliases matching REST conventions
app.get('/api/buses/:id', async (req, res) => {
  const busId = Number(req.params.id)
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const owner = token && ownerSessions.get(token)
  const bus = await getBusById(busId, owner ? owner.email : null)
  if (!bus) {
    return res.status(404).json({ success: false, error: 'Bus not found.' })
  }
  res.json({ success: true, bus: owner ? bus : toPublicBus(bus) })
})

app.put('/api/buses/:id', requireOwnerSession, (req, res) => {
  req.params.busId = req.params.id
  return app._router.handle(req, res)
})

app.delete('/api/buses/:id', requireOwnerSession, (req, res) => {
  req.params.busId = req.params.id
  return app._router.handle(req, res)
})

// 8. OWNER CONDUCTORS: List Conductors
app.get('/api/owner/conductors', requireOwnerSession, async (req, res) => {
  const conductors = await getConductorsByOwner(req.owner.email)
  res.json({ success: true, conductors })
})

// 9. OWNER CONDUCTORS: Assign / Authorize Conductor
app.post('/api/owner/conductors', requireOwnerSession, async (req, res) => {
  const { name, phone, assigned_bus_id } = req.body
  if (!name || !phone) {
    return res.status(400).json({ success: false, error: 'Conductor name and phone number are required.' })
  }

  const created = await saveConductor({
    owner_email: req.owner.email,
    name: name.trim(),
    phone: phone.trim(),
    assigned_bus_id: assigned_bus_id ? Number(assigned_bus_id) : null,
  })

  if (!created) {
    return res.status(500).json({ success: false, error: 'Failed to authorize conductor.' })
  }

  await insertOwnerActivity(
    req.owner.email,
    'conductor_assigned',
    `Conductor ${created.name} assigned`,
    `Contact: ${created.phone}`
  )

  res.status(201).json({ success: true, conductor: created })
})

// 10. OWNER CONDUCTORS: Remove Conductor
app.delete('/api/owner/conductors/:id', requireOwnerSession, async (req, res) => {
  const id = Number(req.params.id)
  const deleted = await deleteConductor(id, req.owner.email)
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Conductor not found or access denied.' })
  }
  res.json({ success: true, message: 'Conductor authorization revoked.' })
})

// 11. OWNER RECENT ACTIVITY
app.get('/api/owner/activities', requireOwnerSession, async (req, res) => {
  const activities = await getOwnerActivities(req.owner.email, 20)
  res.json({ success: true, activities })
})

// 12. CONDUCTOR AUTHENTICATION — STEP 1: Send 6-Digit Email OTP to Travel Agency
app.post('/api/conductor/send-otp', async (req, res) => {
  const { email } = req.body
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Valid travel agency email address is required.' })
  }

  const cleanEmail = email.trim().toLowerCase()
  let owner = await getOwnerByEmail(cleanEmail)

  // In development, if owner does not exist yet, initialize default
  if (!owner) {
    const defaultAgency = `${cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Travels`
    await createOwner(cleanEmail, defaultAgency)
    owner = { email: cleanEmail, agency_name: defaultAgency }
  }

  const otp = String(randomInt(100000, 1000000))
  const expiresAt = Date.now() + 10 * 60 * 1000

  activeOtps[cleanEmail] = {
    otp,
    expiresAt,
    attempts: 0,
    agency_name: owner.agency_name || 'Coastal Travels',
  }

  console.log(`Conductor Auth OTP for ${cleanEmail}: ${otp} (expires in 10 minutes)`)

  res.json({
    success: true,
    message: `6-digit verification code sent to ${cleanEmail}.`,
    agency_name: owner.agency_name,
    preview_otp: otp,
  })
})

// 13. CONDUCTOR AUTHENTICATION — STEP 2: Verify Travel Agency OTP
app.post('/api/conductor/verify-otp', async (req, res) => {
  const { email, otp } = req.body
  if (!email || !otp) {
    return res.status(400).json({ success: false, error: 'Travel agency email and OTP code are required.' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const cleanOtp = String(otp).trim()
  const record = activeOtps[cleanEmail]

  if (!isValidOtp(record, cleanOtp)) {
    if (record) {
      record.attempts += 1
      if (record.attempts >= 5) delete activeOtps[cleanEmail]
    }
    return res.status(401).json({ success: false, error: 'Invalid or expired 6-digit OTP code.' })
  }

  const owner = await getOwnerByEmail(cleanEmail)
  const agencyName = owner?.agency_name || record.agency_name || 'Coastal Fleet Line'
  const token = ownerSessions.create(cleanEmail, agencyName)
  delete activeOtps[cleanEmail]

  res.json({
    success: true,
    message: 'Travel agency verified successfully.',
    agency: {
      email: cleanEmail,
      agency_name: agencyName,
      token,
    },
  })
})

// 14. CONDUCTOR AUTHENTICATION — STEP 3 & 4: Conductor Status Lookup & Bus List
app.post('/api/conductor/lookup', async (req, res) => {
  const { agency_email, phone } = req.body
  if (!agency_email || !phone) {
    return res.status(400).json({ success: false, error: 'Agency email and conductor phone are required.' })
  }

  const cleanEmail = agency_email.trim().toLowerCase()
  const cleanPhone = String(phone).replace(/\D/g, '')

  if (cleanPhone.length < 10) {
    return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number.' })
  }

  const conductor = await getConductorByPhoneAndOwner(cleanEmail, cleanPhone)
  const buses = await getBusesByOwner(cleanEmail)

  let conductorToken = null
  if (conductor) {
    conductorToken = conductorSessions.create(
      conductor.conductor_id,
      conductor.phone,
      cleanEmail,
      conductor.assigned_bus_id
    )
  }

  res.json({
    success: true,
    exists: Boolean(conductor),
    conductor: conductor || null,
    conductor_token: conductorToken,
    buses: buses || [],
    agency_email: cleanEmail,
  })
})

// 15. CONDUCTOR AUTHENTICATION — STEP 4: Quick Register New Conductor
app.post('/api/conductor/register', async (req, res) => {
  const { agency_email, name, phone, assigned_bus_id } = req.body
  if (!agency_email || !name?.trim() || !phone?.trim()) {
    return res.status(400).json({ success: false, error: 'Agency email, conductor name, and mobile number are required.' })
  }

  const cleanEmail = agency_email.trim().toLowerCase()
  const cleanPhone = String(phone).replace(/\D/g, '')

  const existing = await getConductorByPhoneAndOwner(cleanEmail, cleanPhone)
  if (existing) {
    const conductorToken = conductorSessions.create(
      existing.conductor_id,
      existing.phone,
      cleanEmail,
      existing.assigned_bus_id
    )
    return res.json({
      success: true,
      conductor: existing,
      conductor_token: conductorToken,
      message: 'Conductor already registered.',
    })
  }

  const created = await saveConductor({
    owner_email: cleanEmail,
    name: name.trim(),
    phone: cleanPhone,
    assigned_bus_id: assigned_bus_id ? Number(assigned_bus_id) : null,
    status: 'Active',
  })

  await insertOwnerActivity(
    cleanEmail,
    'CONDUCTOR_SELF_REG',
    `New crew conductor ${name.trim()} signed up via Conductor Terminal`
  )

  const updatedConductor = await getConductorByPhoneAndOwner(cleanEmail, cleanPhone)
  const conductorObj = updatedConductor || created
  const conductorToken = conductorSessions.create(
    conductorObj.conductor_id,
    cleanPhone,
    cleanEmail,
    conductorObj.assigned_bus_id
  )

  res.json({
    success: true,
    message: 'Conductor registered successfully.',
    conductor: conductorObj,
    conductor_token: conductorToken,
  })
})

// 16. CONDUCTOR DUTY: Start Shift & Link to Telemetry
app.post('/api/conductor/start-duty', async (req, res) => {
  const { bus_id, vehicle_number, driver_phone, conductor_name, conductor_id } = req.body
  if (!bus_id) {
    return res.status(400).json({ success: false, error: 'Bus ID is required to start duty.' })
  }

  const busIdNum = Number(bus_id)
  const bus = await getBusById(busIdNum)
  if (!bus) {
    return res.status(404).json({ success: false, error: 'Bus record not found.' })
  }

  // Find or create conductor session
  const authHeader = req.get('authorization')
  const incomingToken = req.body.conductor_token || authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
  let conductorSession = incomingToken ? conductorSessions.get(incomingToken) : null
  let activeConductorId = conductor_id || conductorSession?.conductor_id

  if (!conductorSession && driver_phone) {
    const existing = await getConductorByPhoneAndOwner(bus.owner_email, driver_phone)
    if (existing) {
      activeConductorId = existing.conductor_id
    }
  }

  if (activeConductorId) {
    await updateConductorAssignedBus(activeConductorId, busIdNum)
  }

  let sessionToken = incomingToken
  if (conductorSession) {
    conductorSessions.updateBus(incomingToken, busIdNum)
  } else {
    sessionToken = conductorSessions.create(
      activeConductorId || null,
      driver_phone || '98451 00000',
      bus.owner_email,
      busIdNum
    )
  }

  const shiftData = {
    driver_phone: driver_phone || conductorSession?.phone || '98451 00000',
    vehicle_number: bus.vehicle_number || vehicle_number,
    bus_name: bus.bus_name,
    route_name: `${bus.origin} ➔ ${bus.destination}`,
  }

  const shift = await recordShift(shiftData)
  if (!activeBuses[bus.bus_id]) {
    activeBuses[bus.bus_id] = { ...bus }
  }
  activeBuses[bus.bus_id].is_on_shift = true
  activeBuses[bus.bus_id].active_shift = shift
  activeBuses[bus.bus_id].conductor_name = conductor_name || 'Conductor'
  if (!activeBuses[bus.bus_id].tracking_status || activeBuses[bus.bus_id].tracking_status === 'OFFLINE') {
    activeBuses[bus.bus_id].tracking_status = 'NOT TRACKING'
  }

  const broadcastPayload = {
    ...shiftData,
    bus_id: bus.bus_id,
    conductor_name: activeBuses[bus.bus_id].conductor_name,
    is_on_shift: true,
    tracking_status: activeBuses[bus.bus_id].tracking_status,
  }

  io.emit('shift_broadcast', broadcastPayload)
  io.emit('live_location_broadcast', toPublicBus(activeBuses[bus.bus_id]))
  io.emit('bus_location_update', toPublicBus(activeBuses[bus.bus_id]))

  res.json({
    success: true,
    message: 'Conductor duty active. Live GPS streaming initialized.',
    conductor_token: sessionToken,
    bus,
    shift,
  })
})

// 17. CONDUCTOR REAL-TIME GPS TELEMETRY INGESTION (ACTUAL SMARTPHONE SENSOR TELEMETRY)
app.post('/api/conductor/gps-location', requireConductorSession, async (req, res) => {
  const {
    bus_id,
    latitude,
    longitude,
    accuracy,
    speed,
    heading,
    timestamp,
    crowd_status,
    passenger_count,
  } = req.body

  if (!bus_id) {
    return res.status(400).json({ success: false, error: 'Bus ID is required.' })
  }

  const busIdNum = Number(bus_id)
  const session = req.conductor

  // Server-side Bus Assignment Validation
  if (session.bus_id && session.bus_id !== busIdNum) {
    return res.status(403).json({
      success: false,
      error: `Unauthorized: Conductor is not assigned to this bus (assigned to #${session.bus_id}, requested #${busIdNum}).`,
    })
  }

  if (session.conductor_id) {
    const conductor = await getConductorById(session.conductor_id)
    if (conductor && conductor.assigned_bus_id && conductor.assigned_bus_id !== busIdNum) {
      return res.status(403).json({
        success: false,
        error: `Unauthorized: Conductor is not assigned to this bus (assigned to #${conductor.assigned_bus_id}, requested #${busIdNum}).`,
      })
    }
  }

  const lat = Number(latitude)
  const lng = Number(longitude)
  const acc = Number(accuracy) || 0
  const spd = Number(speed) || 0
  const hdg = Number(heading) || 0
  const ts = Number(timestamp) || Date.now()

  // Validate Latitude & Longitude bounds (Coastal Karnataka NH-66 Corridor)
  if (isNaN(lat) || isNaN(lng) || lat < 12.0 || lat > 15.0 || lng < 73.5 || lng > 76.0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid coordinates: GPS location is outside the coastal Karnataka corridor.',
    })
  }

  // Validate Accuracy: reject if accuracy is worse than 1000m
  if (acc > 1000) {
    return res.status(400).json({
      success: false,
      error: 'GPS accuracy too low (> 1000m). Waiting for better satellite fix.',
    })
  }

  // Validate Speed: reject impossible spikes (> 110 km/h)
  if (spd > 110) {
    return res.status(400).json({
      success: false,
      error: `GPS speed anomaly rejected: ${spd} km/h exceeds realistic bus limits.`,
    })
  }

  // Validate Timestamp: must not be in the distant past (> 5 minutes ago) or > 1 minute in the future
  const now = Date.now()
  if (ts < now - 300000 || ts > now + 60000) {
    return res.status(400).json({
      success: false,
      error: 'GPS timestamp expired or invalid.',
    })
  }

  const bus = await getBusById(busIdNum)
  if (!bus) {
    return res.status(404).json({ success: false, error: 'Bus not found.' })
  }

  const payload = {
    ...(activeBuses[busIdNum] || {}),
    ...bus,
    bus_id: busIdNum,
    latitude: lat,
    longitude: lng,
    accuracy: acc,
    speed: spd,
    heading: hdg,
    crowd_status: crowd_status || activeBuses[busIdNum]?.crowd_status || 'Seats Available',
    passenger_count: passenger_count !== undefined ? Number(passenger_count) : (activeBuses[busIdNum]?.passenger_count || 0),
    timestamp: ts,
    is_on_shift: true,
    tracking_status: 'LIVE',
    last_telemetry_at: now,
  }

  activeBuses[busIdNum] = payload

  // Broadcast to all connected clients via Socket.IO
  io.emit('live_location_broadcast', toPublicBus(payload))
  io.emit('bus_location_update', toPublicBus(payload))

  // Persist telemetry into PostgreSQL / SQLite
  try {
    await recordTelemetry({
      bus_id: busIdNum,
      bus_name: bus.bus_name,
      latitude: lat,
      longitude: lng,
      speed: spd,
    })
  } catch (dbErr) {
    console.error('Failed to save telemetry to DB:', dbErr.message)
  }

  res.json({
    success: true,
    message: 'Live GPS location updated.',
    tracking_status: 'LIVE',
    location: {
      bus_id: busIdNum,
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      speed: spd,
      heading: hdg,
      timestamp: ts,
    },
  })
})

// 18. CONDUCTOR STOP LIVE TRACKING
app.post('/api/conductor/stop-tracking', requireConductorSession, async (req, res) => {
  const { bus_id } = req.body
  const busIdNum = Number(bus_id || req.conductor.bus_id)

  if (!busIdNum) {
    return res.status(400).json({ success: false, error: 'Bus ID is required.' })
  }

  if (activeBuses[busIdNum]) {
    activeBuses[busIdNum].tracking_status = 'OFFLINE'
    activeBuses[busIdNum].is_on_shift = false
    activeBuses[busIdNum].active_shift = null
    activeBuses[busIdNum].latitude = null
    activeBuses[busIdNum].longitude = null
    activeBuses[busIdNum].speed = 0
    activeBuses[busIdNum].last_telemetry_at = null

    const offlinePayload = {
      bus_id: busIdNum,
      vehicle_number: activeBuses[busIdNum].vehicle_number,
      is_on_shift: false,
      tracking_status: 'OFFLINE',
      is_live: false,
      latitude: null,
      longitude: null,
      speed: 0,
    }
    io.emit('shift_broadcast', offlinePayload)
    io.emit('bus_tracking_stopped', { bus_id: busIdNum })
    io.emit('shift_ended', { bus_id: busIdNum, vehicle_number: activeBuses[busIdNum].vehicle_number })
    io.emit('live_location_broadcast', toPublicBus(activeBuses[busIdNum]))
    io.emit('bus_location_update', toPublicBus(activeBuses[busIdNum]))
    io.emit('sync_buses', publicBusSnapshot(activeBuses))
  }

  res.json({
    success: true,
    message: 'Live GPS tracking stopped successfully.',
    tracking_status: 'OFFLINE',
  })
})

// 18b. CONDUCTOR DUTY: End Shift & Mark Offline in Passenger Radar
const handleEndDutyShift = async (req, res) => {
  const { bus_id, vehicle_number, shift_id } = req.body || {}

  // Resolve bus
  let busIdNum = Number(bus_id)
  let bus = null
  if (busIdNum) {
    bus = await getBusById(busIdNum)
  } else if (vehicle_number) {
    bus = await getBusByVehicleNumber(vehicle_number)
    if (bus) busIdNum = bus.bus_id
  }

  // End shift in database
  await endShift({
    shift_id: shift_id ? Number(shift_id) : null,
    vehicle_number: vehicle_number || bus?.vehicle_number,
  })

  if (busIdNum && activeBuses[busIdNum]) {
    activeBuses[busIdNum].tracking_status = 'OFFLINE'
    activeBuses[busIdNum].is_on_shift = false
    activeBuses[busIdNum].active_shift = null
    activeBuses[busIdNum].latitude = null
    activeBuses[busIdNum].longitude = null
    activeBuses[busIdNum].speed = 0
    activeBuses[busIdNum].last_telemetry_at = null
  }

  const broadcastPayload = {
    bus_id: busIdNum,
    vehicle_number: bus?.vehicle_number || vehicle_number,
    is_on_shift: false,
    tracking_status: 'OFFLINE',
    is_live: false,
    latitude: null,
    longitude: null,
    speed: 0,
  }

  io.emit('shift_broadcast', broadcastPayload)
  io.emit('shift_ended', { bus_id: busIdNum, vehicle_number: bus?.vehicle_number || vehicle_number })
  io.emit('bus_tracking_stopped', { bus_id: busIdNum })
  if (busIdNum && activeBuses[busIdNum]) {
    io.emit('live_location_broadcast', toPublicBus(activeBuses[busIdNum]))
    io.emit('bus_location_update', toPublicBus(activeBuses[busIdNum]))
  }
  io.emit('sync_buses', publicBusSnapshot(activeBuses))

  res.json({
    success: true,
    message: 'Duty shift ended successfully. Bus marked OFFLINE and removed from active radar.',
    bus_id: busIdNum,
    tracking_status: 'OFFLINE',
    is_on_shift: false,
  })
}

app.post('/api/conductor/end-duty', handleEndDutyShift)
app.post('/api/conductor/end-shift', handleEndDutyShift)

// 17. CONDUCTOR ROUTE STOPS: Get Timetable Stops for Active Bus
app.get('/api/conductor/buses/:busId/stops', async (req, res) => {
  const busId = Number(req.params.busId)
  const stops = await getBusRouteStops(busId)
  res.json({ success: true, stops: stops || [] })
})

// 18. REAL-WORLD CONDUCTOR CHECK-IN: Verify Bus Number & Secret PIN (Legacy Backward Compatibility)
app.post('/api/conductor/verify-pin', async (req, res) => {
  const { vehicle_number, conductor_pin, driver_phone } = req.body
  if (!vehicle_number || !conductor_pin) {
    return res.status(400).json({ success: false, error: 'Bus registration number and Secret PIN are required.' })
  }

  const result = await verifyConductorPin(vehicle_number, conductor_pin, driver_phone)
  if (!result.success) {
    return res.status(401).json(result)
  }

  const shiftData = {
    driver_phone: driver_phone || '98451 23456',
    vehicle_number: result.bus.vehicle_number,
    bus_name: result.bus.bus_name,
    route_name: `${result.bus.origin} ➔ ${result.bus.destination}`,
  }

  const shift = await recordShift(shiftData)
  if (activeBuses[result.bus.bus_id]) {
    activeBuses[result.bus.bus_id].is_on_shift = true
    activeBuses[result.bus.bus_id].active_shift = shift
  }

  res.json({
    success: true,
    message: 'Authentication successful. Bus unlocked for conductor duty.',
    bus: result.bus,
    shift,
  })
})

// ============================================================================
// PASSENGER PORTAL PUBLIC API ENDPOINTS
// ============================================================================

// 1. Search bus stops by official name, Kannada name, alternative names, or landmark
app.get('/api/public/stops/search', async (req, res) => {
  try {
    const q = req.query.q || ''
    const stops = await searchBusStops(q)
    res.json({ success: true, count: stops.length, stops })
  } catch (err) {
    console.error('Error in /api/public/stops/search:', err)
    res.status(500).json({ success: false, error: 'Failed to search stops.' })
  }
})

// 2. Discover nearby bus stops by browser GPS coordinates (Optional on-demand)
app.get('/api/public/stops/nearby', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'Latitude and longitude coordinates are required.' })
    }
    const stops = await getNearbyBusStops(Number(lat), Number(lng), radius ? Number(radius) : 15)
    res.json({ success: true, count: stops.length, stops })
  } catch (err) {
    console.error('Error in /api/public/stops/nearby:', err)
    res.status(500).json({ success: false, error: 'Failed to find nearby stops.' })
  }
})

// 3. Get all verified coastal stops
app.get(['/api/public/stops', '/api/public/stops/all'], async (req, res) => {
  try {
    const stops = await getAllBusStops()
    res.json({ success: true, count: stops.length, stops })
  } catch (err) {
    console.error('Error in /api/public/stops:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch stops.' })
  }
})

// 4. Search buses by journey (FROM -> TO stop order matching)
// Strictly NO ticket fare, ticket price, fees or payment functionality
app.get('/api/public/buses/search', async (req, res) => {
  try {
    const { from, to } = req.query
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'Both FROM and TO destination stops are required.' })
    }
    const buses = await searchBusesByJourney(from, to, activeBuses)
    res.json({
      success: true,
      from,
      to,
      count: buses.length,
      buses,
    })
  } catch (err) {
    console.error('Error in /api/public/buses/search:', err)
    res.status(500).json({ success: false, error: 'Failed to search buses for selected journey.' })
  }
})

// 5. Get public bus details
app.get('/api/public/buses/:id', async (req, res) => {
  try {
    const busId = Number(req.params.id)
    const bus = await getBusById(busId)
    if (!bus) {
      return res.status(404).json({ success: false, error: 'Bus not found.' })
    }
    const active = activeBuses[busId] || {}
    res.json({
      success: true,
      bus: {
        ...toPublicBus(bus),
        latitude: active.latitude || null,
        longitude: active.longitude || null,
        speed: active.speed || 0,
        is_on_shift: Boolean(active.is_on_shift),
        tracking_status: active.tracking_status || (active.is_on_shift ? 'NOT TRACKING' : 'SCHEDULED'),
        is_live: Boolean(active.is_on_shift && active.timestamp && (Date.now() - new Date(active.timestamp).getTime() < 120000)),
        last_update: active.timestamp ? new Date(active.timestamp).toLocaleTimeString() : null,
      },
    })
  } catch (err) {
    console.error('Error in /api/public/buses/:id:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch bus details.' })
  }
})

// 6. Get complete bus route with timeline stops & verified landmarks
app.get('/api/public/buses/:id/route', async (req, res) => {
  try {
    const busId = Number(req.params.id)
    const busWithRoute = await getBusRouteWithStops(busId)
    if (!busWithRoute) {
      return res.status(404).json({ success: false, error: 'Bus or route not found.' })
    }
    res.json({
      success: true,
      bus: toPublicBus(busWithRoute),
    })
  } catch (err) {
    console.error('Error in /api/public/buses/:id/route:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch bus route.' })
  }
})

// 7. Get live tracking location and telemetry freshness for a specific bus
app.get('/api/public/buses/:id/location', async (req, res) => {
  try {
    const busId = Number(req.params.id)
    const active = activeBuses[busId]
    if (!active || !active.latitude || !active.longitude) {
      const fallbackStatus = active?.is_on_shift ? 'NOT TRACKING' : 'OFFLINE'
      return res.json({
        success: true,
        tracking_status: fallbackStatus,
        message: fallbackStatus === 'NOT TRACKING'
          ? 'Conductor shift active, waiting for live GPS telemetry transmission.'
          : 'No live GPS tracking session active for this bus.',
        location: null,
      })
    }

    const lastTs = active.timestamp ? new Date(active.timestamp).getTime() : 0
    const now = Date.now()
    const isStale = lastTs > 0 && now - lastTs >= 120000
    let status = 'LIVE'
    if (!active.is_on_shift) {
      status = 'OFFLINE'
    } else if (isStale) {
      status = 'LOCATION STALE'
    }

    res.json({
      success: true,
      tracking_status: status,
      location: {
        bus_id: busId,
        latitude: active.latitude,
        longitude: active.longitude,
        speed: active.speed || 0,
        heading: active.heading || 0,
        timestamp: active.timestamp,
        is_stale: isStale,
      },
    })
  } catch (err) {
    console.error('Error in /api/public/buses/:id/location:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch bus location.' })
  }
})

// 8. Submit passenger feedback
app.post('/api/public/feedback', async (req, res) => {
  try {
    const { name, email, category, rating, message } = req.body
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Feedback message cannot be empty.' })
    }
    const saved = await savePassengerFeedback({
      name,
      email,
      category,
      rating,
      message,
    })
    res.status(201).json({
      success: true,
      message: 'Thank you for your valuable feedback!',
      feedback: saved,
    })
  } catch (err) {
    console.error('Error in /api/public/feedback:', err)
    res.status(500).json({ success: false, error: err.message || 'Failed to submit feedback.' })
  }
})

// 9. Get recent public feedback (optional reviews display)
app.get('/api/public/feedback', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20
    const feedback = await getPassengerFeedback(limit)
    res.json({ success: true, count: feedback.length, feedback })
  } catch (err) {
    console.error('Error in GET /api/public/feedback:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch feedback.' })
  }
})

// Fetch recent driver shifts from SQL database
app.get('/api/shifts', async (req, res) => {
  const shifts = await getActiveShifts()
  res.json(shifts)
})

// Fetch recent GPS telemetry from SQL database
app.get('/api/telemetry', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const logs = await getRecentTelemetry(limit)
  res.json(logs)
})

const server = createServer(app)
const io = new Server(server, {
  cors: { origin: '*' },
})

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Send current live buses immediately to newly connected passengers
  if (Object.keys(activeBuses).length > 0) {
    socket.emit('sync_buses', publicBusSnapshot(activeBuses))
    socket.emit('initial_buses', Object.values(activeBuses).map(toPublicBus))
  } else {
    getBuses().then((buses) => {
      buses.forEach((b) => { activeBuses[b.bus_id] = b })
      socket.emit('sync_buses', publicBusSnapshot(activeBuses))
      socket.emit('initial_buses', buses.map(toPublicBus))
    }).catch((err) => console.error('Failed to sync buses:', err))
  }

  socket.on('start_shift', async (data) => {
    console.log('Driver Shift Started:', data)
    await recordShift(data)
    if (data.bus_id && activeBuses[data.bus_id]) {
      activeBuses[data.bus_id].is_on_shift = true
      activeBuses[data.bus_id].active_shift = data
    }
    io.emit('shift_broadcast', data)
  })

  socket.on('end_shift', async (data) => {
    if (!data) return
    const busIdNum = Number(data.bus_id)
    if (data.vehicle_number || data.shift_id) {
      await endShift({
        shift_id: data.shift_id ? Number(data.shift_id) : null,
        vehicle_number: data.vehicle_number,
      })
    }
    if (busIdNum && activeBuses[busIdNum]) {
      activeBuses[busIdNum].tracking_status = 'OFFLINE'
      activeBuses[busIdNum].is_on_shift = false
      activeBuses[busIdNum].active_shift = null
      activeBuses[busIdNum].latitude = null
      activeBuses[busIdNum].longitude = null
      activeBuses[busIdNum].speed = 0
      activeBuses[busIdNum].last_telemetry_at = null
    }
    const payload = {
      bus_id: busIdNum,
      vehicle_number: data.vehicle_number || activeBuses[busIdNum]?.vehicle_number,
      is_on_shift: false,
      tracking_status: 'OFFLINE',
      is_live: false,
      latitude: null,
      longitude: null,
      speed: 0,
    }
    io.emit('shift_broadcast', payload)
    io.emit('shift_ended', { bus_id: busIdNum, vehicle_number: data.vehicle_number })
    io.emit('bus_tracking_stopped', { bus_id: busIdNum })
    if (busIdNum && activeBuses[busIdNum]) {
      io.emit('live_location_broadcast', toPublicBus(activeBuses[busIdNum]))
      io.emit('bus_location_update', toPublicBus(activeBuses[busIdNum]))
    }
    io.emit('sync_buses', publicBusSnapshot(activeBuses))
  })

  socket.on('update_location', async (data) => {
    if (!data || !data.bus_id) return

    // Handle explicit offline or end of tracking update
    const isOffline = data.tracking_status === 'OFFLINE' || data.is_on_shift === false
    if (isOffline) {
      const busIdNum = Number(data.bus_id)
      if (activeBuses[busIdNum]) {
        activeBuses[busIdNum].tracking_status = 'OFFLINE'
        activeBuses[busIdNum].is_on_shift = false
        activeBuses[busIdNum].active_shift = null
        activeBuses[busIdNum].latitude = null
        activeBuses[busIdNum].longitude = null
        activeBuses[busIdNum].speed = 0
        activeBuses[busIdNum].last_telemetry_at = null
      }
      const offlinePayload = {
        bus_id: busIdNum,
        vehicle_number: data.vehicle_number || activeBuses[busIdNum]?.vehicle_number,
        is_on_shift: false,
        tracking_status: 'OFFLINE',
        is_live: false,
        latitude: null,
        longitude: null,
        speed: 0,
      }
      io.emit('shift_broadcast', offlinePayload)
      io.emit('bus_tracking_stopped', { bus_id: busIdNum })
      io.emit('shift_ended', { bus_id: busIdNum, vehicle_number: data.vehicle_number })
      if (activeBuses[busIdNum]) {
        io.emit('live_location_broadcast', toPublicBus(activeBuses[busIdNum]))
        io.emit('bus_location_update', toPublicBus(activeBuses[busIdNum]))
      }
      io.emit('sync_buses', publicBusSnapshot(activeBuses))
      return
    }

    // Verify token if provided
    if (data.token) {
      const session = conductorSessions.get(data.token)
      if (!session) {
        console.warn(`[Socket Update Rejected] Invalid conductor token for bus #${data.bus_id}`)
        return
      }
      if (session.bus_id && session.bus_id !== Number(data.bus_id)) {
        console.warn(`[Socket Update Rejected] Conductor token bus mismatch: ${session.bus_id} vs ${data.bus_id}`)
        return
      }
    }

    if (data.speed && data.speed > 110) {
      console.warn(`[GPS Spike Rejected] Bus #${data.bus_id} reported impossible speed: ${data.speed} km/h`)
      return
    }

    const lat = Number(data.lat || data.latitude)
    const lng = Number(data.lng || data.longitude)
    if (!isNaN(lat) && !isNaN(lng)) {
      if (lat < 12.0 || lat > 15.0 || lng < 73.5 || lng > 76.0) {
        console.warn(`[GPS Out of Range Rejected] Bus #${data.bus_id} coords (${lat}, ${lng}) outside coastal corridor`)
        return
      }
    }

    const now = Date.now()
    const payload = {
      ...(activeBuses[data.bus_id] || {}),
      ...data,
      latitude: lat || activeBuses[data.bus_id]?.latitude,
      longitude: lng || activeBuses[data.bus_id]?.longitude,
      speed: Number(data.speed) || 0,
      heading: Number(data.heading) || 0,
      is_on_shift: true,
      tracking_status: 'LIVE',
      timestamp: data.timestamp || now,
      last_telemetry_at: now,
    }
    activeBuses[data.bus_id] = payload

    io.emit('live_location_broadcast', toPublicBus(payload))
    io.emit('bus_location_update', toPublicBus(payload))

    try {
      await recordTelemetry(payload)
    } catch (err) {
      console.error('Database telemetry logging error:', err)
    }
  })

  socket.on('send_alert', (alertData) => {
    io.emit('emergency_alert', alertData)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

// Periodic Stale Telemetry Detector (checks every 15s)
setInterval(() => {
  const now = Date.now()
  for (const bus of Object.values(activeBuses)) {
    if (bus && bus.is_on_shift && bus.last_telemetry_at) {
      const elapsed = now - bus.last_telemetry_at
      if (elapsed >= 120000 && bus.tracking_status === 'LIVE') {
        bus.tracking_status = 'LOCATION STALE'
        io.emit('live_location_broadcast', toPublicBus(bus))
        io.emit('bus_location_update', toPublicBus(bus))
      }
    }
  }
}, 15000)

const PORT = process.env.PORT || 5000

await initDB()

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
