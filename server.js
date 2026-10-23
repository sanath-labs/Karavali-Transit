import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import {
  getActiveShifts,
  getBuses,
  getRecentTelemetry,
  initDB,
  isDbConnected,
  recordShift,
  recordTelemetry,
} from './db.js'

const app = express()
app.use(cors())
app.use(express.json())

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    sql_connected: isDbConnected(),
    database_type: 'SQL (SQLite transit.db)',
    timestamp: new Date().toISOString(),
  })
})

// Fetch all buses from SQL database
app.get('/api/buses', async (req, res) => {
  const buses = await getBuses()
  res.json(buses)
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

// Store live bus telemetry in memory (Zomato-style instant relay cache)
const activeBuses = {}

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
    // Step 4: Speed Validation Check — Ignore unrealistic bus teleportation spikes
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

    // 1. Instantly broadcast to all connected passengers in milliseconds (Zomato-style push)
    io.emit('live_location_broadcast', payload)
    io.emit('bus_location_update', payload)

    // 2. Asynchronously persist location log into SQL database table
    try {
      await recordTelemetry(payload)
    } catch (err) {
      console.error('Database telemetry logging error:', err)
    }
  })

  // Emergency / Traffic delay notifications
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
  // Initialize SQL Database tables and seed initial coastal buses
  await initDB()
})