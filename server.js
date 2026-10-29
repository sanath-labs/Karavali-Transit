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
  getActiveShifts,
  getBuses,
  getBusesByOwner,
  getBusByVehicleNumber,
  getConductorsByOwner,
  getDatabaseType,
  getOwnerActivities,
  getOwnerByEmail,
  getOwnerDashboardData,
  getRecentTelemetry,
  initDB,
  insertOwnerActivity,
  isDbConnected,
  recordShift,
  recordTelemetry,
  saveBus,
  saveConductor,
  updateBusPin,
  verifyConductorPin,
} from './db.js'
import { createOwnerSessionManager, isValidOtp, toPublicBus } from './serverAuth.js'

const app = express()
app.use(cors())
app.use(express.json())

// In-memory fast relay & OTP cache
const activeBuses = {}
const activeOtps = {}
const ownerSessions = createOwnerSessionManager()

function publicBusSnapshot(buses) {
  return Object.fromEntries(
    Object.entries(buses).map(([id, bus]) => [id, toPublicBus(bus)])
  )
}

function requireOwnerSession(req, res, next) {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const owner = token && ownerSessions.get(token)
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

// 6. OWNER FLEET: Update Secret Conductor PIN
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

  res.json({ success: true, message: 'Conductor PIN updated.' })
})

// 7. OWNER FLEET: Delete Bus
app.delete('/api/owner/buses/:busId', requireOwnerSession, async (req, res) => {
  const busId = Number(req.params.busId)
  const ownedBuses = await getBusesByOwner(req.owner.email)
  if (!ownedBuses.some((bus) => bus.bus_id === busId)) {
    return res.status(404).json({ success: false, error: 'Bus not found in this owner fleet.' })
  }
  const deleted = await deleteBus(busId)
  if (!deleted) {
    return res.status(500).json({ success: false, error: 'Failed to remove bus from fleet.' })
  }
  delete activeBuses[busId]
  io.emit('sync_buses', publicBusSnapshot(activeBuses))
  res.json({ success: true, message: 'Bus removed.' })
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

// 12. REAL-WORLD CONDUCTOR CHECK-IN: Verify Bus Number & Secret PIN
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

  socket.on('update_location', async (data) => {
    if (data.speed && data.speed > 100) {
      console.warn(`[GPS Spike Rejected] Bus #${data.bus_id} reported impossible speed: ${data.speed} km/h`)
      return
    }

    const payload = {
      ...(activeBuses[data.bus_id] || {}),
      ...data,
      is_on_shift: true,
      timestamp: data.timestamp || Date.now(),
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

const PORT = process.env.PORT || 5000

await initDB()
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
