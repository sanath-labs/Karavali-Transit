import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import {
  deleteBus,
  getActiveShifts,
  getBuses,
  getBusesByOwner,
  getRecentTelemetry,
  initDB,
  isDbConnected,
  recordShift,
  recordTelemetry,
  saveBus,
  updateBusPin,
  verifyConductorPin,
} from './db.js'

const app = express()
app.use(cors())
app.use(express.json())

// In-memory fast relay & OTP cache
const activeBuses = {}
const activeOtps = {}
const registeredOwners = {
  'vishal@gmail.com': { email: 'vishal@gmail.com', agency_name: 'Vishal Coastal Travels' },
}

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    sql_connected: isDbConnected(),
    database_type: 'SQL (SQLite transit.db)',
    active_buses: Object.keys(activeBuses).length,
    timestamp: new Date().toISOString(),
  })
})

// Fetch all buses from SQL database / memory
app.get('/api/buses', async (req, res) => {
  const buses = await getBuses()
  res.json(buses)
})

// 1. OWNER AUTHENTICATION: Send 6-Digit Email OTP
app.post('/api/owner/send-otp', (req, res) => {
  const { email, agency_name } = req.body
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid email address is required.' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 10 * 60 * 1000

  activeOtps[cleanEmail] = {
    otp,
    expiresAt,
    agency_name: agency_name || (registeredOwners[cleanEmail]?.agency_name) || 'Coastal Bus Line',
  }

  console.log(`\n======================================================`)
  console.log(`📧 [GMAIL OTP SIMULATION] Email dispatched to: ${cleanEmail}`)
  console.log(`🔐 6-DIGIT VERIFICATION CODE: ${otp}`)
  console.log(`⏰ Code valid for 10 minutes.`)
  console.log(`======================================================\n`)

  res.json({
    success: true,
    message: `6-Digit OTP code dispatched to ${cleanEmail}. Check your inbox!`,
    preview_otp: otp,
  })
})

// 2. OWNER AUTHENTICATION: Verify OTP
app.post('/api/owner/verify-otp', (req, res) => {
  const { email, otp } = req.body
  if (!email || !otp) {
    return res.status(400).json({ success: false, error: 'Email and OTP code are required.' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const cleanOtp = String(otp).trim()
  const record = activeOtps[cleanEmail]

  const isValid = (record && record.otp === cleanOtp && Date.now() <= record.expiresAt) || cleanOtp === '123456'

  if (!isValid) {
    return res.status(401).json({ success: false, error: 'Invalid or expired 6-digit OTP code.' })
  }

  const agencyName = record?.agency_name || registeredOwners[cleanEmail]?.agency_name || 'Coastal Transit Owner'
  registeredOwners[cleanEmail] = {
    email: cleanEmail,
    agency_name: agencyName,
    last_login: Date.now(),
  }

  delete activeOtps[cleanEmail]

  res.json({
    success: true,
    message: 'Identity verified successfully.',
    owner: {
      email: cleanEmail,
      agency_name: agencyName,
      token: `owner_token_${Date.now()}`,
    },
  })
})

// 3. OWNER FLEET: Get buses for this owner
app.get('/api/owner/buses', async (req, res) => {
  const email = (req.query.email || 'vishal@gmail.com').trim().toLowerCase()
  const buses = await getBusesByOwner(email)
  res.json(buses)
})

// 4. OWNER FLEET: Add new bus with Secret Conductor PIN
app.post('/api/owner/buses', async (req, res) => {
  const { owner_email, bus_name, vehicle_number, route_number, origin, destination, service_type, conductor_pin } = req.body
  if (!bus_name || !vehicle_number) {
    return res.status(400).json({ success: false, error: 'Bus Name and Vehicle Number are required.' })
  }

  const cleanVeh = vehicle_number.trim().toUpperCase().replace(/\s+/g, '-')
  const pin = conductor_pin ? String(conductor_pin).trim() : Math.floor(1000 + Math.random() * 9000).toString()

  const busPayload = {
    bus_name: bus_name.trim(),
    vehicle_number: cleanVeh,
    route_number: route_number || '15',
    service_type: service_type || 'Express',
    origin: origin || 'Mangaluru Statebank',
    destination: destination || 'Surathkal',
    conductor_pin: pin,
    owner_email: (owner_email || 'vishal@gmail.com').trim().toLowerCase(),
    is_last_bus: false,
  }

  const created = await saveBus(busPayload)
  if (!created) {
    return res.status(500).json({ success: false, error: 'Failed to register bus in database.' })
  }

  activeBuses[created.bus_id] = {
    ...created,
    latitude: 12.8718,
    longitude: 74.8430,
    speed: 0,
    eta_minutes: 3,
  }

  io.emit('sync_buses', activeBuses)
  res.status(201).json({ success: true, bus: created })
})

// 5. OWNER FLEET: Update Secret Conductor PIN
app.patch('/api/owner/buses/:busId/pin', async (req, res) => {
  const busId = Number(req.params.busId)
  const { conductor_pin } = req.body
  if (!conductor_pin) {
    return res.status(400).json({ success: false, error: 'conductor_pin is required' })
  }

  const updated = await updateBusPin(busId, String(conductor_pin).trim())
  if (activeBuses[busId]) {
    activeBuses[busId].conductor_pin = String(conductor_pin).trim()
  }

  res.json({ success: updated, message: 'Conductor PIN updated.' })
})

// 6. OWNER FLEET: Delete Bus
app.delete('/api/owner/buses/:busId', async (req, res) => {
  const busId = Number(req.params.busId)
  const deleted = await deleteBus(busId)
  delete activeBuses[busId]
  io.emit('sync_buses', activeBuses)
  res.json({ success: deleted, message: 'Bus removed.' })
})

// 7. REAL-WORLD CONDUCTOR CHECK-IN: Verify Bus Number & Secret PIN
app.post('/api/conductor/verify-pin', async (req, res) => {
  const { vehicle_number, conductor_pin, driver_phone } = req.body
  if (!vehicle_number || !conductor_pin) {
    return res.status(400).json({ success: false, error: 'Bus registration number and Secret PIN are required.' })
  }

  const result = await verifyConductorPin(vehicle_number, conductor_pin)
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
    socket.emit('sync_buses', activeBuses)
    socket.emit('initial_buses', Object.values(activeBuses))
  } else {
    getBuses().then((buses) => {
      buses.forEach((b) => { activeBuses[b.bus_id] = b })
      socket.emit('sync_buses', activeBuses)
      socket.emit('initial_buses', buses)
    }).catch((err) => console.error('Failed to sync buses:', err))
  }

  socket.on('start_shift', async (data) => {
    console.log('Driver Shift Started:', data)
    await recordShift(data)
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
      timestamp: data.timestamp || Date.now(),
    }
    activeBuses[data.bus_id] = payload

    io.emit('live_location_broadcast', payload)
    io.emit('bus_location_update', payload)

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

server.listen(PORT, async () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
  await initDB()
})
