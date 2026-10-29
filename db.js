import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sqlite3 from 'sqlite3'
import pg from 'pg'
import { matchesConductorPin } from './serverAuth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, 'transit.db')

// SQLite Instance (Lazy loaded to prevent uncloneable C++ handles in worker threads)
let _sqliteDb = null

export function getSqliteDb() {
  if (!_sqliteDb) {
    _sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) console.error('❌ Could not connect to SQLite database:', err.message)
    })
  }
  return _sqliteDb
}

export const sqliteDb = {
  run(...args) { return getSqliteDb().run(...args) },
  all(...args) { return getSqliteDb().all(...args) },
  get(...args) { return getSqliteDb().get(...args) },
  serialize(...args) { return getSqliteDb().serialize(...args) },
  prepare(...args) { return getSqliteDb().prepare(...args) },
}
export const db = sqliteDb // Backward compatibility alias

// PostgreSQL Pool (External / Local service)
const pgPool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: String(process.env.PGPASSWORD || ''),
  database: process.env.PGDATABASE || 'karavali_transit',
  max: 10,
  idleTimeoutMillis: 1000,
  allowExitOnIdle: true,
})

let isConnected = false
let activeEngine = 'sqlite' // 'postgres' | 'sqlite'

export function isDbConnected() {
  return isConnected
}

export function getDatabaseType() {
  return activeEngine === 'postgres'
    ? `PostgreSQL (${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432} / ${process.env.PGDATABASE || 'karavali_transit'})`
    : 'SQL (SQLite transit.db)'
}

export function isPostgres() {
  return activeEngine === 'postgres'
}

// Initialize Database Schema & Seed Initial Buses
export async function initDB() {
  if (process.env.USE_POSTGRES === 'true') {
    try {
      const client = await pgPool.connect()
      await client.query('SELECT 1')
      client.release()
      activeEngine = 'postgres'
      isConnected = true
      console.log(`✅ SQL Database connected: ${getDatabaseType()}`)
      await initPostgresSchema()
      return true
    } catch (err) {
      console.warn('⚠️ Could not connect to PostgreSQL, falling back to SQLite:', err.message)
    }
  }

  // SQLite Initialization
  activeEngine = 'sqlite'
  return initSqliteSchema()
}

// ============================================================================
// POSTGRESQL SCHEMA INITIALIZATION
// ============================================================================
async function initPostgresSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS buses (
      bus_id SERIAL PRIMARY KEY,
      bus_name TEXT NOT NULL,
      vehicle_number TEXT NOT NULL UNIQUE,
      route_number TEXT NOT NULL,
      service_type TEXT NOT NULL DEFAULT 'Express',
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      is_last_bus INTEGER DEFAULT 0,
      conductor_pin TEXT,
      owner_email TEXT DEFAULT 'vishal@gmail.com',
      total_seats INTEGER DEFAULT 45,
      photo_url TEXT,
      departure_time TEXT,
      frequency TEXT DEFAULT 'Daily',
      journey_duration TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS driver_shifts (
      shift_id SERIAL PRIMARY KEY,
      driver_phone TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      bus_name TEXT NOT NULL,
      route_name TEXT NOT NULL,
      start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_time TIMESTAMP,
      status TEXT DEFAULT 'ACTIVE'
    );

    CREATE TABLE IF NOT EXISTS gps_telemetry (
      log_id SERIAL PRIMARY KEY,
      bus_id INTEGER,
      bus_name TEXT,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      speed INTEGER DEFAULT 0,
      delay_minutes INTEGER DEFAULT 0,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS owners (
      owner_id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      agency_name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_otps (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bus_route_stops (
      id SERIAL PRIMARY KEY,
      bus_id INTEGER NOT NULL REFERENCES buses(bus_id) ON DELETE CASCADE,
      stop_order INTEGER NOT NULL,
      stop_name TEXT NOT NULL,
      planned_arrival TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conductors (
      conductor_id SERIAL PRIMARY KEY,
      owner_email TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      assigned_bus_id INTEGER REFERENCES buses(bus_id) ON DELETE SET NULL,
      status TEXT DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS owner_activities (
      activity_id SERIAL PRIMARY KEY,
      owner_email TEXT NOT NULL,
      action_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Check seed buses
  const countRes = await pgPool.query('SELECT COUNT(*) AS count FROM buses')
  if (Number(countRes.rows[0].count) === 0) {
    const seedBuses = [
      ['Vishal Express', 'KA-19-AB-4509', '15', 'Express', 'Mangaluru', 'Surathkal', 0, '4509', 'vishal@gmail.com', 45, '06:30 AM', 'Daily', '35 minutes'],
      ['Canara Pinto Deluxe', 'KA-20-C-8812', 'NH-66', 'Express', 'Mangaluru', 'Udupi', 0, '8812', 'vishal@gmail.com', 50, '07:15 AM', 'Daily', '1 hour 45 minutes'],
      ['Padmambika Local', 'KA-19-F-3304', '21', 'City / Ordinary', 'Mangaluru', 'Kuloor', 1, '3304', 'vishal@gmail.com', 40, '08:00 AM', 'Daily', '30 minutes']
    ]

    for (const b of seedBuses) {
      const ins = await pgPool.query(
        `INSERT INTO buses (bus_name, vehicle_number, route_number, service_type, origin, destination, is_last_bus, conductor_pin, owner_email, total_seats, departure_time, frequency, journey_duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING bus_id`,
        b
      )
      const busId = ins.rows[0].bus_id
      await pgPool.query(
        `INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES
         ($1, 1, 'Mangaluru', '06:30 AM'),
         ($1, 2, 'Surathkal', '07:05 AM'),
         ($1, 3, 'Kundapura', '09:00 AM'),
         ($1, 4, 'Udupi', '10:00 AM')`,
        [busId]
      )
    }
  }

  // Seed owners
  await pgPool.query(`
    INSERT INTO owners (email, agency_name) VALUES ('vishal@gmail.com', 'Vishal Coastal Travels') ON CONFLICT (email) DO NOTHING;
    INSERT INTO owners (email, agency_name) VALUES ('rakesh@gmail.com', 'Rakesh Shetty Travels') ON CONFLICT (email) DO NOTHING;
  `)

  console.log('✅ PostgreSQL Database initialized (tables: buses, driver_shifts, gps_telemetry, owners, email_otps, bus_route_stops, conductors, owner_activities)')
  return true
}

// ============================================================================
// SQLITE SCHEMA INITIALIZATION
// ============================================================================
function initSqliteSchema() {
  return new Promise((resolve, reject) => {
    sqliteDb.serialize(() => {
      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS buses (
          bus_id INTEGER PRIMARY KEY AUTOINCREMENT,
          bus_name TEXT NOT NULL,
          vehicle_number TEXT NOT NULL UNIQUE,
          route_number TEXT NOT NULL,
          service_type TEXT NOT NULL DEFAULT 'Express',
          origin TEXT NOT NULL,
          destination TEXT NOT NULL,
          is_last_bus INTEGER DEFAULT 0,
          conductor_pin TEXT,
          owner_email TEXT DEFAULT 'vishal@gmail.com',
          total_seats INTEGER DEFAULT 45,
          photo_url TEXT,
          departure_time TEXT,
          frequency TEXT DEFAULT 'Daily',
          journey_duration TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      sqliteDb.run('ALTER TABLE buses ADD COLUMN conductor_pin TEXT', () => {})
      sqliteDb.run("ALTER TABLE buses ADD COLUMN owner_email TEXT DEFAULT 'vishal@gmail.com'", () => {})
      sqliteDb.run('ALTER TABLE buses ADD COLUMN total_seats INTEGER DEFAULT 45', () => {})
      sqliteDb.run('ALTER TABLE buses ADD COLUMN photo_url TEXT', () => {})
      sqliteDb.run('ALTER TABLE buses ADD COLUMN departure_time TEXT', () => {})
      sqliteDb.run("ALTER TABLE buses ADD COLUMN frequency TEXT DEFAULT 'Daily'", () => {})
      sqliteDb.run('ALTER TABLE buses ADD COLUMN journey_duration TEXT', () => {})

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS driver_shifts (
          shift_id INTEGER PRIMARY KEY AUTOINCREMENT,
          driver_phone TEXT NOT NULL,
          vehicle_number TEXT NOT NULL,
          bus_name TEXT NOT NULL,
          route_name TEXT NOT NULL,
          start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          end_time DATETIME,
          status TEXT DEFAULT 'ACTIVE'
        )
      `)

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS gps_telemetry (
          log_id INTEGER PRIMARY KEY AUTOINCREMENT,
          bus_id INTEGER,
          bus_name TEXT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          speed INTEGER DEFAULT 0,
          delay_minutes INTEGER DEFAULT 0,
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS owners (
          owner_id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          agency_name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS email_otps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          otp_code TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used INTEGER DEFAULT 0
        )
      `)

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS bus_route_stops (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bus_id INTEGER NOT NULL,
          stop_order INTEGER NOT NULL,
          stop_name TEXT NOT NULL,
          planned_arrival TEXT NOT NULL,
          FOREIGN KEY (bus_id) REFERENCES buses(bus_id) ON DELETE CASCADE
        )
      `)

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS conductors (
          conductor_id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_email TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          assigned_bus_id INTEGER,
          status TEXT DEFAULT 'Active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (assigned_bus_id) REFERENCES buses(bus_id) ON DELETE SET NULL
        )
      `)

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS owner_activities (
          activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_email TEXT NOT NULL,
          action_type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      sqliteDb.get('SELECT COUNT(*) AS count FROM buses', (err, row) => {
        if (err) {
          console.error('Error checking buses table:', err.message)
          reject(err)
          return
        }

        if (row && row.count === 0) {
          const stmt = sqliteDb.prepare(`
            INSERT INTO buses (bus_name, vehicle_number, route_number, service_type, origin, destination, is_last_bus, conductor_pin, owner_email, total_seats, departure_time, frequency, journey_duration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)

          stmt.run('Vishal Express', 'KA-19-AB-4509', '15', 'Express', 'Mangaluru', 'Surathkal', 0, '4509', 'vishal@gmail.com', 45, '06:30 AM', 'Daily', '35 minutes')
          stmt.run('Canara Pinto Deluxe', 'KA-20-C-8812', 'NH-66', 'Express', 'Mangaluru', 'Udupi', 0, '8812', 'vishal@gmail.com', 50, '07:15 AM', 'Daily', '1 hour 45 minutes')
          stmt.run('Padmambika Local', 'KA-19-F-3304', '21', 'City / Ordinary', 'Mangaluru', 'Kuloor', 1, '3304', 'vishal@gmail.com', 40, '08:00 AM', 'Daily', '30 minutes')
          stmt.finalize(() => {
            seedDefaultStopsSqlite()
          })
        } else {
          sqliteDb.run("UPDATE buses SET conductor_pin = '4509' WHERE vehicle_number = 'KA-19-AB-4509' AND (conductor_pin IS NULL OR conductor_pin = '')")
          sqliteDb.run("UPDATE buses SET conductor_pin = '8812' WHERE vehicle_number = 'KA-20-C-8812' AND (conductor_pin IS NULL OR conductor_pin = '')")
          sqliteDb.run("UPDATE buses SET conductor_pin = '3304' WHERE vehicle_number = 'KA-19-F-3304' AND (conductor_pin IS NULL OR conductor_pin = '')")
          sqliteDb.run("UPDATE buses SET owner_email = 'vishal@gmail.com' WHERE owner_email IS NULL OR owner_email = ''")
          seedDefaultStopsSqlite()
        }

        sqliteDb.run("INSERT OR IGNORE INTO owners (email, agency_name) VALUES ('vishal@gmail.com', 'Vishal Coastal Travels')")
        sqliteDb.run("INSERT OR IGNORE INTO owners (email, agency_name) VALUES ('rakesh@gmail.com', 'Rakesh Shetty Travels')")

        isConnected = true
        console.log(`✅ SQL Database connected: ${getDatabaseType()}`)
        resolve(true)
      })
    })
  })
}

function seedDefaultStopsSqlite() {
  sqliteDb.get('SELECT COUNT(*) AS count FROM bus_route_stops', (_, row) => {
    if (row && row.count === 0) {
      const stopStmt = sqliteDb.prepare('INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES (?, ?, ?, ?)')
      stopStmt.run(1, 1, 'Mangaluru', '06:30 AM')
      stopStmt.run(1, 2, 'Surathkal', '07:05 AM')
      stopStmt.run(1, 3, 'Kundapura', '09:00 AM')
      stopStmt.run(1, 4, 'Udupi', '10:00 AM')

      stopStmt.run(2, 1, 'Mangaluru', '07:15 AM')
      stopStmt.run(2, 2, 'Kuloor', '07:35 AM')
      stopStmt.run(2, 3, 'Surathkal', '08:00 AM')
      stopStmt.run(2, 4, 'Udupi', '09:15 AM')

      stopStmt.run(3, 1, 'Mangaluru', '08:00 AM')
      stopStmt.run(3, 2, 'Urwa Market', '08:15 AM')
      stopStmt.run(3, 3, 'Kuloor', '08:35 AM')
      stopStmt.finalize()
    }
  })
}

// ============================================================================
// DATA ACCESS FUNCTIONS (DUAL ENGINE)
// ============================================================================

// 1. Shift Recording
export async function recordShift(data) {
  if (isPostgres()) {
    const res = await pgPool.query(
      `INSERT INTO driver_shifts (driver_phone, vehicle_number, bus_name, route_name)
       VALUES ($1, $2, $3, $4) RETURNING shift_id`,
      [data.driver_phone, data.vehicle_number, data.bus_name, data.route_name]
    )
    return { shift_id: res.rows[0].shift_id, ...data }
  }

  return new Promise((resolve) => {
    sqliteDb.run(
      'INSERT INTO driver_shifts (driver_phone, vehicle_number, bus_name, route_name) VALUES (?, ?, ?, ?)',
      [data.driver_phone, data.vehicle_number, data.bus_name, data.route_name],
      function (err) {
        if (err) resolve(null)
        else resolve({ shift_id: this.lastID, ...data })
      }
    )
  })
}

// 2. GPS Telemetry Recording
export async function recordTelemetry(data) {
  if (isPostgres()) {
    const res = await pgPool.query(
      `INSERT INTO gps_telemetry (bus_id, bus_name, latitude, longitude, speed, delay_minutes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING log_id`,
      [data.bus_id || 1, data.bus_name || 'Vishal Express', data.latitude, data.longitude, data.speed || 0, data.delay_minutes || 0]
    )
    return res.rows[0].log_id
  }

  return new Promise((resolve) => {
    sqliteDb.run(
      'INSERT INTO gps_telemetry (bus_id, bus_name, latitude, longitude, speed, delay_minutes) VALUES (?, ?, ?, ?, ?, ?)',
      [data.bus_id || 1, data.bus_name || 'Vishal Express', data.latitude, data.longitude, data.speed || 0, data.delay_minutes || 0],
      function (err) {
        if (err) resolve(null)
        else resolve(this.lastID)
      }
    )
  })
}

// 3. Fetch Route Stops for a Bus
export async function getBusRouteStops(busId) {
  if (isPostgres()) {
    const res = await pgPool.query(
      'SELECT stop_order, stop_name, planned_arrival FROM bus_route_stops WHERE bus_id = $1 ORDER BY stop_order ASC',
      [busId]
    )
    return res.rows || []
  }

  return new Promise((resolve) => {
    sqliteDb.all(
      'SELECT stop_order, stop_name, planned_arrival FROM bus_route_stops WHERE bus_id = ? ORDER BY stop_order ASC',
      [busId],
      (err, rows) => {
        resolve(err ? [] : rows || [])
      }
    )
  })
}

// 4. Fetch All Registered Buses
export async function getBuses() {
  if (isPostgres()) {
    const res = await pgPool.query('SELECT * FROM buses ORDER BY bus_id ASC')
    const buses = res.rows || []
    return Promise.all(
      buses.map(async (bus) => {
        const stops = await getBusRouteStops(bus.bus_id)
        return {
          ...bus,
          stops: stops.length > 0 ? stops : [
            { stop_order: 1, stop_name: bus.origin || 'Mangaluru', planned_arrival: bus.departure_time || '06:30 AM' },
            { stop_order: 2, stop_name: bus.destination || 'Udupi', planned_arrival: '10:00 AM' },
          ],
        }
      })
    )
  }

  return new Promise((resolve) => {
    sqliteDb.all('SELECT * FROM buses ORDER BY bus_id ASC', async (err, rows) => {
      if (err || !rows) return resolve([])
      const busesWithStops = await Promise.all(
        rows.map(async (bus) => {
          const stops = await getBusRouteStops(bus.bus_id)
          return {
            ...bus,
            stops: stops.length > 0 ? stops : [
              { stop_order: 1, stop_name: bus.origin || 'Mangaluru', planned_arrival: bus.departure_time || '06:30 AM' },
              { stop_order: 2, stop_name: bus.destination || 'Udupi', planned_arrival: '10:00 AM' },
            ],
          }
        })
      )
      resolve(busesWithStops)
    })
  })
}

// 5. Fetch Single Bus by Vehicle Number
export async function getBusByVehicleNumber(vehicleNumber) {
  const normalized = vehicleNumber.replace(/\s+/g, '-').toUpperCase()

  if (isPostgres()) {
    const res = await pgPool.query(
      `SELECT * FROM buses WHERE UPPER(REPLACE(vehicle_number, ' ', '-')) = $1 LIMIT 1`,
      [normalized]
    )
    if (!res.rows || res.rows.length === 0) return null
    const bus = res.rows[0]
    const stops = await getBusRouteStops(bus.bus_id)
    return { ...bus, stops }
  }

  return new Promise((resolve) => {
    sqliteDb.get(
      'SELECT * FROM buses WHERE UPPER(REPLACE(vehicle_number, " ", "-")) = ? LIMIT 1',
      [normalized],
      async (err, row) => {
        if (err || !row) resolve(null)
        else {
          const stops = await getBusRouteStops(row.bus_id)
          resolve({ ...row, stops })
        }
      }
    )
  })
}

// 6. Fetch Single Bus by ID
export async function getBusById(busId) {
  if (isPostgres()) {
    const res = await pgPool.query('SELECT * FROM buses WHERE bus_id = $1 LIMIT 1', [busId])
    if (!res.rows || res.rows.length === 0) return null
    const bus = res.rows[0]
    const stops = await getBusRouteStops(busId)
    return { ...bus, stops }
  }

  return new Promise((resolve) => {
    sqliteDb.get('SELECT * FROM buses WHERE bus_id = ? LIMIT 1', [busId], async (err, row) => {
      if (err || !row) resolve(null)
      else {
        const stops = await getBusRouteStops(busId)
        resolve({ ...row, stops })
      }
    })
  })
}

// 7. Fetch Buses by Owner
export async function getBusesByOwner(ownerEmail) {
  if (isPostgres()) {
    const res = await pgPool.query(
      'SELECT * FROM buses WHERE LOWER(owner_email) = LOWER($1) ORDER BY bus_id ASC',
      [ownerEmail]
    )
    const buses = res.rows || []
    return Promise.all(
      buses.map(async (bus) => {
        const stops = await getBusRouteStops(bus.bus_id)
        return {
          ...bus,
          stops: stops.length > 0 ? stops : [
            { stop_order: 1, stop_name: bus.origin || 'Mangaluru', planned_arrival: bus.departure_time || '06:30 AM' },
            { stop_order: 2, stop_name: bus.destination || 'Udupi', planned_arrival: '10:00 AM' },
          ],
        }
      })
    )
  }

  return new Promise((resolve) => {
    sqliteDb.all('SELECT * FROM buses WHERE LOWER(owner_email) = LOWER(?) ORDER BY bus_id ASC', [ownerEmail], async (err, rows) => {
      if (err || !rows) return resolve([])
      const busesWithStops = await Promise.all(
        rows.map(async (bus) => {
          const stops = await getBusRouteStops(bus.bus_id)
          return {
            ...bus,
            stops: stops.length > 0 ? stops : [
              { stop_order: 1, stop_name: bus.origin || 'Mangaluru', planned_arrival: bus.departure_time || '06:30 AM' },
              { stop_order: 2, stop_name: bus.destination || 'Udupi', planned_arrival: '10:00 AM' },
            ],
          }
        })
      )
      resolve(busesWithStops)
    })
  })
}

// 8. Owner Authentication Helpers
export async function getOwnerByEmail(email) {
  if (isPostgres()) {
    const res = await pgPool.query('SELECT email, agency_name FROM owners WHERE LOWER(email) = LOWER($1) LIMIT 1', [email])
    return res.rows?.[0] || null
  }

  return new Promise((resolve, reject) => {
    sqliteDb.get(
      'SELECT email, agency_name FROM owners WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email],
      (err, row) => {
        if (err) reject(err)
        else resolve(row || null)
      }
    )
  })
}

export async function createOwner(email, agencyName) {
  if (isPostgres()) {
    try {
      await pgPool.query(
        'INSERT INTO owners (email, agency_name) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
        [email.toLowerCase(), agencyName]
      )
      return true
    } catch {
      return false
    }
  }

  return new Promise((resolve) => {
    sqliteDb.run(
      'INSERT OR IGNORE INTO owners (email, agency_name) VALUES (?, ?)',
      [email.toLowerCase(), agencyName],
      function (err) {
        resolve(!err)
      }
    )
  })
}

// 9. Conductor PIN Verification
export async function verifyConductorPin(vehicleNumber, pin, driverPhone = null) {
  const normalized = vehicleNumber.replace(/\s+/g, '-').toUpperCase()

  let bus = null
  if (isPostgres()) {
    const res = await pgPool.query(
      `SELECT * FROM buses WHERE UPPER(REPLACE(vehicle_number, ' ', '-')) = $1 LIMIT 1`,
      [normalized]
    )
    bus = res.rows?.[0] || null
  } else {
    bus = await new Promise((resolve) => {
      sqliteDb.get(
        'SELECT * FROM buses WHERE UPPER(REPLACE(vehicle_number, " ", "-")) = ? LIMIT 1',
        [normalized],
        (err, row) => resolve(row || null)
      )
    })
  }

  if (!bus) return { success: false, error: 'Vehicle number not found in registered fleet.' }
  if (!matchesConductorPin(bus.conductor_pin, pin)) {
    return { success: false, error: 'Incorrect Secret PIN for ' + bus.vehicle_number }
  }

  if (driverPhone) {
    const cleanPhone = String(driverPhone).replace(/\D/g, '')
    let conductors = []
    if (isPostgres()) {
      const cRes = await pgPool.query(
        'SELECT * FROM conductors WHERE (assigned_bus_id = $1 OR assigned_bus_id IS NULL) AND LOWER(owner_email) = LOWER($2)',
        [bus.bus_id, bus.owner_email]
      )
      conductors = cRes.rows || []
    } else {
      conductors = await new Promise((resolve) => {
        sqliteDb.all(
          'SELECT * FROM conductors WHERE (assigned_bus_id = ? OR assigned_bus_id IS NULL) AND LOWER(owner_email) = LOWER(?)',
          [bus.bus_id, bus.owner_email],
          (err, rows) => resolve(rows || [])
        )
      })
    }

    const matching = conductors.find((c) => c.phone.replace(/\D/g, '').includes(cleanPhone))
    if (matching && matching.status !== 'Active') {
      return { success: false, error: 'Conductor duty authorization has been revoked.' }
    }
  }

  return { success: true, bus }
}

// 10. Save Bus (with multi-stop route)
export async function saveBus(bus) {
  const cleanVeh = bus.vehicle_number.toUpperCase()
  const stops = Array.isArray(bus.stops) ? bus.stops : []

  if (isPostgres()) {
    try {
      const ins = await pgPool.query(
        `INSERT INTO buses (
          bus_name, vehicle_number, route_number, service_type,
          origin, destination, is_last_bus, conductor_pin,
          owner_email, total_seats, photo_url, departure_time,
          frequency, journey_duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING bus_id`,
        [
          bus.bus_name,
          cleanVeh,
          bus.route_number || '001',
          bus.service_type || 'Express',
          bus.origin || 'Mangaluru',
          bus.destination || 'Udupi',
          bus.is_last_bus ? 1 : 0,
          bus.conductor_pin || null,
          bus.owner_email || 'vishal@gmail.com',
          bus.total_seats || 45,
          bus.photo_url || '/images/coastal-private-bus.jpg',
          bus.departure_time || '06:30 AM',
          bus.frequency || 'Daily',
          bus.journey_duration || '3 hours 30 minutes',
        ]
      )

      const newBusId = ins.rows[0].bus_id
      for (let idx = 0; idx < stops.length; idx++) {
        await pgPool.query(
          'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES ($1, $2, $3, $4)',
          [newBusId, idx + 1, stops[idx].stop_name || '', stops[idx].planned_arrival || '']
        )
      }

      return { bus_id: newBusId, ...bus, stops }
    } catch (err) {
      console.error('Error inserting bus to PostgreSQL:', err.message)
      return null
    }
  }

  // SQLite Save Bus
  return new Promise((resolve) => {
    sqliteDb.run(
      `INSERT INTO buses (
        bus_name, vehicle_number, route_number, service_type,
        origin, destination, is_last_bus, conductor_pin,
        owner_email, total_seats, photo_url, departure_time,
        frequency, journey_duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bus.bus_name,
        cleanVeh,
        bus.route_number || '001',
        bus.service_type || 'Express',
        bus.origin || 'Mangaluru',
        bus.destination || 'Udupi',
        bus.is_last_bus ? 1 : 0,
        bus.conductor_pin || null,
        bus.owner_email || 'vishal@gmail.com',
        bus.total_seats || 45,
        bus.photo_url || '/images/coastal-private-bus.jpg',
        bus.departure_time || '06:30 AM',
        bus.frequency || 'Daily',
        bus.journey_duration || '3 hours 30 minutes',
      ],
      function (err) {
        if (err) {
          console.error('Error inserting bus to SQLite:', err.message)
          resolve(null)
          return
        }

        const newBusId = this.lastID
        if (stops.length === 0) {
          resolve({ bus_id: newBusId, ...bus, stops: [] })
          return
        }

        const stmt = sqliteDb.prepare(
          'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES (?, ?, ?, ?)'
        )
        stops.forEach((stop, idx) => {
          stmt.run(newBusId, idx + 1, stop.stop_name || '', stop.planned_arrival || '')
        })
        stmt.finalize(() => {
          resolve({ bus_id: newBusId, ...bus, stops })
        })
      }
    )
  })
}

// 11. Update Conductor PIN
export async function updateBusPin(busId, pin) {
  if (isPostgres()) {
    const res = await pgPool.query('UPDATE buses SET conductor_pin = $1 WHERE bus_id = $2', [pin, busId])
    return res.rowCount > 0
  }

  return new Promise((resolve) => {
    sqliteDb.run('UPDATE buses SET conductor_pin = ? WHERE bus_id = ?', [pin, busId], function (err) {
      resolve(!err && this.changes > 0)
    })
  })
}

// 12. Delete Bus
export async function deleteBus(busId) {
  if (isPostgres()) {
    await pgPool.query('DELETE FROM bus_route_stops WHERE bus_id = $1', [busId])
    const res = await pgPool.query('DELETE FROM buses WHERE bus_id = $1', [busId])
    return res.rowCount > 0
  }

  return new Promise((resolve) => {
    sqliteDb.run('DELETE FROM bus_route_stops WHERE bus_id = ?', [busId], () => {
      sqliteDb.run('DELETE FROM buses WHERE bus_id = ?', [busId], function (err) {
        resolve(!err && this.changes > 0)
      })
    })
  })
}

// 13. Telemetry & Shifts Querying
export async function getRecentTelemetry(limit = 20) {
  if (isPostgres()) {
    const res = await pgPool.query('SELECT * FROM gps_telemetry ORDER BY log_id DESC LIMIT $1', [limit])
    return res.rows || []
  }

  return new Promise((resolve) => {
    sqliteDb.all('SELECT * FROM gps_telemetry ORDER BY log_id DESC LIMIT ?', [limit], (err, rows) => {
      resolve(err ? [] : rows || [])
    })
  })
}

export async function getActiveShifts() {
  if (isPostgres()) {
    const res = await pgPool.query("SELECT * FROM driver_shifts WHERE status = 'ACTIVE' ORDER BY shift_id DESC")
    return res.rows || []
  }

  return new Promise((resolve) => {
    sqliteDb.all("SELECT * FROM driver_shifts WHERE status = 'ACTIVE' ORDER BY shift_id DESC", (err, rows) => {
      resolve(err ? [] : rows || [])
    })
  })
}

// 14. Conductors Management
export async function getConductorsByOwner(ownerEmail) {
  const query = `
    SELECT c.*, b.bus_name, b.vehicle_number
    FROM conductors c
    LEFT JOIN buses b ON c.assigned_bus_id = b.bus_id
    WHERE LOWER(c.owner_email) = LOWER($1)
    ORDER BY c.conductor_id DESC
  `
  if (isPostgres()) {
    const res = await pgPool.query(query, [ownerEmail])
    return res.rows || []
  }

  const sqliteQuery = `
    SELECT c.*, b.bus_name, b.vehicle_number
    FROM conductors c
    LEFT JOIN buses b ON c.assigned_bus_id = b.bus_id
    WHERE LOWER(c.owner_email) = LOWER(?)
    ORDER BY c.conductor_id DESC
  `
  return new Promise((resolve) => {
    sqliteDb.all(sqliteQuery, [ownerEmail], (err, rows) => {
      resolve(err ? [] : rows || [])
    })
  })
}

export async function saveConductor(data) {
  if (isPostgres()) {
    const res = await pgPool.query(
      `INSERT INTO conductors (owner_email, name, phone, assigned_bus_id, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING conductor_id`,
      [data.owner_email, data.name, data.phone, data.assigned_bus_id || null, data.status || 'Active']
    )
    return { conductor_id: res.rows[0].conductor_id, ...data }
  }

  return new Promise((resolve) => {
    sqliteDb.run(
      'INSERT INTO conductors (owner_email, name, phone, assigned_bus_id, status) VALUES (?, ?, ?, ?, ?)',
      [data.owner_email, data.name, data.phone, data.assigned_bus_id || null, data.status || 'Active'],
      function (err) {
        if (err) resolve(null)
        else resolve({ conductor_id: this.lastID, ...data })
      }
    )
  })
}

export async function deleteConductor(conductorId, ownerEmail) {
  if (isPostgres()) {
    const res = await pgPool.query(
      'DELETE FROM conductors WHERE conductor_id = $1 AND LOWER(owner_email) = LOWER($2)',
      [conductorId, ownerEmail]
    )
    return res.rowCount > 0
  }

  return new Promise((resolve) => {
    sqliteDb.run(
      'DELETE FROM conductors WHERE conductor_id = ? AND LOWER(owner_email) = LOWER(?)',
      [conductorId, ownerEmail],
      function (err) {
        resolve(!err && this.changes > 0)
      }
    )
  })
}

// 15. Owner Activities Logging
export async function getOwnerActivities(ownerEmail, limit = 10) {
  if (isPostgres()) {
    const res = await pgPool.query(
      'SELECT * FROM owner_activities WHERE LOWER(owner_email) = LOWER($1) ORDER BY activity_id DESC LIMIT $2',
      [ownerEmail, limit]
    )
    return res.rows || []
  }

  return new Promise((resolve) => {
    sqliteDb.all(
      'SELECT * FROM owner_activities WHERE LOWER(owner_email) = LOWER(?) ORDER BY activity_id DESC LIMIT ?',
      [ownerEmail, limit],
      (err, rows) => {
        resolve(err ? [] : rows || [])
      }
    )
  })
}

export async function insertOwnerActivity(ownerEmail, actionType, title, description = '') {
  if (isPostgres()) {
    const res = await pgPool.query(
      'INSERT INTO owner_activities (owner_email, action_type, title, description) VALUES ($1, $2, $3, $4) RETURNING activity_id',
      [ownerEmail, actionType, title, description]
    )
    return res.rows[0].activity_id
  }

  return new Promise((resolve) => {
    sqliteDb.run(
      'INSERT INTO owner_activities (owner_email, action_type, title, description) VALUES (?, ?, ?, ?)',
      [ownerEmail, actionType, title, description],
      function (err) {
        if (err) resolve(null)
        else resolve(this.lastID)
      }
    )
  })
}

// 16. Aggregate Owner Dashboard
export async function getOwnerDashboardData(ownerEmail, activeBuses = {}) {
  const buses = await getBusesByOwner(ownerEmail)
  const conductors = await getConductorsByOwner(ownerEmail)
  const activities = await getOwnerActivities(ownerEmail, 10)

  const distinctRoutes = new Set(buses.map((b) => b.route_number).filter(Boolean))
  const liveCount = buses.filter((b) => {
    const active = activeBuses[b.bus_id]
    return active && (active.speed > 0 || active.active_shift || active.is_on_shift)
  }).length

  const busesWithStatus = buses.map((b) => {
    const active = activeBuses[b.bus_id]
    const isLive = Boolean(active && (active.speed > 0 || active.active_shift || active.is_on_shift))
    return {
      ...b,
      is_live: isLive,
      tracking_status: isLive ? 'Live On Shift' : 'Offline / Not Started',
    }
  })

  return {
    stats: {
      total_buses: buses.length,
      total_conductors: conductors.length,
      total_routes: distinctRoutes.size || (buses.length > 0 ? 1 : 0),
      live_buses: liveCount,
    },
    recent_activity: activities,
    buses: busesWithStatus,
    conductors,
  }
}
