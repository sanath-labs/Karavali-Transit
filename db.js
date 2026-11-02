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
let initDbPromise = null
export async function initDB() {
  if (initDbPromise) return initDbPromise
  initDbPromise = (async () => {
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
        console.error('❌ Failed to connect to configured PostgreSQL database:', err.message)
        throw err
      }
    }

    // SQLite Initialization
    activeEngine = 'sqlite'
    return initSqliteSchema()
  })()
  return initDbPromise
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

    CREATE TABLE IF NOT EXISTS bus_stops (
      stop_id SERIAL PRIMARY KEY,
      stop_name TEXT NOT NULL UNIQUE,
      stop_name_kn TEXT NOT NULL,
      alternative_names TEXT NOT NULL,
      nearby_landmarks TEXT NOT NULL,
      locality TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS passenger_feedback (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      category TEXT DEFAULT 'General',
      rating INTEGER DEFAULT 5,
      message TEXT NOT NULL,
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

  await seedRakeshFleetPg()
  await seedVerifiedBusStopsPg()

  console.log('✅ PostgreSQL Database initialized (tables: buses, driver_shifts, gps_telemetry, owners, email_otps, bus_route_stops, conductors, owner_activities, bus_stops, passenger_feedback)')
  return true
}

async function seedRakeshFleetPg() {
  try {
    const rakeshBuses = [
      {
        bus_name: 'Shri Durga Travels',
        vehicle_number: 'KA 19 AB 1234',
        route_number: '001',
        service_type: 'Non AC',
        origin: 'Surathkal',
        destination: 'Udupi',
        total_seats: 45,
        photo_url: '/images/coastal-private-bus.jpg',
        departure_time: '10:40 AM',
        frequency: 'Daily',
        journey_duration: '1 hour 35 minutes',
        stops: [
          { stop_name: 'Surathkal', planned_arrival: '10:40 AM' },
          { stop_name: 'Mulki', planned_arrival: '11:05 AM' },
          { stop_name: 'Kaup', planned_arrival: '11:25 AM' },
          { stop_name: 'Kundapura', planned_arrival: '11:50 AM' },
          { stop_name: 'Udupi', planned_arrival: '12:15 PM' },
        ],
      },
      {
        bus_name: 'Sri Lakshmi Travels',
        vehicle_number: 'KA 20 CD 5678',
        route_number: '002',
        service_type: 'AC',
        origin: 'Surathkal',
        destination: 'Udupi',
        total_seats: 40,
        photo_url: '/images/coastal-private-bus.jpg',
        departure_time: '11:15 AM',
        frequency: 'Daily',
        journey_duration: '1 hour 35 minutes',
        stops: [
          { stop_name: 'Surathkal', planned_arrival: '11:15 AM' },
          { stop_name: 'Mulki', planned_arrival: '11:40 AM' },
          { stop_name: 'Kaup', planned_arrival: '12:00 PM' },
          { stop_name: 'Kundapura', planned_arrival: '12:25 PM' },
          { stop_name: 'Udupi', planned_arrival: '12:50 PM' },
        ],
      },
      {
        bus_name: 'Shree Ganesh Travels',
        vehicle_number: 'KA 19 EF 9012',
        route_number: '003',
        service_type: 'Non AC',
        origin: 'Mangaluru',
        destination: 'Surathkal',
        total_seats: 50,
        photo_url: '/images/coastal-private-bus.jpg',
        departure_time: '08:15 AM',
        frequency: 'Daily',
        journey_duration: '40 minutes',
        stops: [
          { stop_name: 'Mangaluru', planned_arrival: '08:15 AM' },
          { stop_name: 'Kottara Chowki', planned_arrival: '08:25 AM' },
          { stop_name: 'Kulai', planned_arrival: '08:40 AM' },
          { stop_name: 'Surathkal', planned_arrival: '08:55 AM' },
        ],
      },
      {
        bus_name: 'Udupi Express',
        vehicle_number: 'KA 21 GH 3456',
        route_number: '004',
        service_type: 'Non AC',
        origin: 'Surathkal',
        destination: 'Udupi',
        total_seats: 45,
        photo_url: '/images/coastal-private-bus.jpg',
        departure_time: '12:30 PM',
        frequency: 'Daily',
        journey_duration: '1 hour 35 minutes',
        stops: [
          { stop_name: 'Surathkal', planned_arrival: '12:30 PM' },
          { stop_name: 'Mulki', planned_arrival: '12:55 PM' },
          { stop_name: 'Kaup', planned_arrival: '01:15 PM' },
          { stop_name: 'Kundapura', planned_arrival: '01:40 PM' },
          { stop_name: 'Udupi', planned_arrival: '02:05 PM' },
        ],
      },
    ]

    for (const b of rakeshBuses) {
      const cleanVeh = b.vehicle_number.toUpperCase().replace(/\s+/g, '-')
      const exist = await pgPool.query(
        `SELECT bus_id FROM buses WHERE UPPER(REPLACE(vehicle_number, ' ', '-')) = $1`,
        [cleanVeh]
      )
      let busId
      if (exist.rows.length === 0) {
        const ins = await pgPool.query(
          `INSERT INTO buses (
            bus_name, vehicle_number, route_number, service_type,
            origin, destination, is_last_bus, conductor_pin,
            owner_email, total_seats, photo_url, departure_time,
            frequency, journey_duration
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, '4509', 'rakesh@gmail.com', $7, $8, $9, $10, $11)
          RETURNING bus_id`,
          [
            b.bus_name,
            cleanVeh,
            b.route_number,
            b.service_type,
            b.origin,
            b.destination,
            b.total_seats,
            b.photo_url,
            b.departure_time,
            b.frequency,
            b.journey_duration,
          ]
        )
        busId = ins.rows[0].bus_id
      } else {
        busId = exist.rows[0].bus_id
        await pgPool.query(
          `UPDATE buses SET bus_name = $1, service_type = $2, departure_time = $3, origin = $4, destination = $5, owner_email = 'rakesh@gmail.com' WHERE bus_id = $6`,
          [b.bus_name, b.service_type, b.departure_time, b.origin, b.destination, busId]
        )
      }

      if (b.vehicle_number === 'KA 19 AB 1234' || b.vehicle_number === 'KA 20 CD 5678' || b.vehicle_number === 'KA 21 GH 3456') {
        await pgPool.query('DELETE FROM bus_route_stops WHERE bus_id = $1', [busId])
        for (let i = 0; i < b.stops.length; i++) {
          await pgPool.query(
            'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES ($1, $2, $3, $4)',
            [busId, i + 1, b.stops[i].stop_name, b.stops[i].planned_arrival]
          )
        }
      } else {
        const stopsCount = await pgPool.query('SELECT COUNT(*) AS count FROM bus_route_stops WHERE bus_id = $1', [busId])
        if (Number(stopsCount.rows[0].count) === 0) {
          for (let i = 0; i < b.stops.length; i++) {
            await pgPool.query(
              'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES ($1, $2, $3, $4)',
              [busId, i + 1, b.stops[i].stop_name, b.stops[i].planned_arrival]
            )
          }
        }
      }
    }

    const condCount = await pgPool.query(
      'SELECT COUNT(*) AS count FROM conductors WHERE LOWER(owner_email) = $1',
      ['rakesh@gmail.com']
    )
    if (Number(condCount.rows[0].count) === 0) {
      const defaultConds = [
        ['rakesh@gmail.com', 'Manjunath Shetty', '98451 12345'],
        ['rakesh@gmail.com', 'Santhosh Poojary', '98452 23456'],
        ['rakesh@gmail.com', 'Pradeep Kumar', '98453 34567'],
        ['rakesh@gmail.com', 'Dinesh Acharya', '98454 45678'],
        ['rakesh@gmail.com', 'Raghavendra Rao', '98455 56789'],
      ]
      for (const c of defaultConds) {
        await pgPool.query('INSERT INTO conductors (owner_email, name, phone) VALUES ($1, $2, $3)', c)
      }
    }
  } catch (err) {
    console.warn('Could not seed Rakesh fleet:', err.message)
  }
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

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS bus_stops (
          stop_id INTEGER PRIMARY KEY AUTOINCREMENT,
          stop_name TEXT NOT NULL UNIQUE,
          stop_name_kn TEXT NOT NULL,
          alternative_names TEXT NOT NULL,
          nearby_landmarks TEXT NOT NULL,
          locality TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS passenger_feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT,
          category TEXT DEFAULT 'General',
          rating INTEGER DEFAULT 5,
          message TEXT NOT NULL,
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

        seedRakeshFleetSqlite(() => {
          seedVerifiedBusStopsSqlite(() => {
            isConnected = true
            console.log(`✅ SQL Database connected: ${getDatabaseType()}`)
            resolve(true)
          })
        })
      })
    })
  })
}

function seedRakeshFleetSqlite(cb) {
  const rakeshBuses = [
    {
      bus_name: 'Shri Durga Travels',
      vehicle_number: 'KA-19-AB-1234',
      route_number: '001',
      service_type: 'Non AC',
      origin: 'Surathkal',
      destination: 'Udupi',
      total_seats: 45,
      departure_time: '10:40 AM',
      frequency: 'Daily',
      journey_duration: '1 hour 35 minutes',
      stops: [
        { stop_name: 'Surathkal', planned_arrival: '10:40 AM' },
        { stop_name: 'Mulki', planned_arrival: '11:05 AM' },
        { stop_name: 'Kaup', planned_arrival: '11:25 AM' },
        { stop_name: 'Kundapura', planned_arrival: '11:50 AM' },
        { stop_name: 'Udupi', planned_arrival: '12:15 PM' },
      ],
    },
    {
      bus_name: 'Sri Lakshmi Travels',
      vehicle_number: 'KA-20-CD-5678',
      route_number: '002',
      service_type: 'AC',
      origin: 'Surathkal',
      destination: 'Udupi',
      total_seats: 40,
      departure_time: '11:15 AM',
      frequency: 'Daily',
      journey_duration: '1 hour 35 minutes',
      stops: [
        { stop_name: 'Surathkal', planned_arrival: '11:15 AM' },
        { stop_name: 'Mulki', planned_arrival: '11:40 AM' },
        { stop_name: 'Kaup', planned_arrival: '12:00 PM' },
        { stop_name: 'Kundapura', planned_arrival: '12:25 PM' },
        { stop_name: 'Udupi', planned_arrival: '12:50 PM' },
      ],
    },
    {
      bus_name: 'Shree Ganesh Travels',
      vehicle_number: 'KA-19-EF-9012',
      route_number: '003',
      service_type: 'Non AC',
      origin: 'Mangaluru',
      destination: 'Surathkal',
      total_seats: 50,
      departure_time: '08:15 AM',
      frequency: 'Daily',
      journey_duration: '40 minutes',
      stops: [
        { stop_name: 'Mangaluru', planned_arrival: '08:15 AM' },
        { stop_name: 'Kottara Chowki', planned_arrival: '08:25 AM' },
        { stop_name: 'Kulai', planned_arrival: '08:40 AM' },
        { stop_name: 'Surathkal', planned_arrival: '08:55 AM' },
      ],
    },
    {
      bus_name: 'Udupi Express',
      vehicle_number: 'KA-21-GH-3456',
      route_number: '004',
      service_type: 'Non AC',
      origin: 'Surathkal',
      destination: 'Udupi',
      total_seats: 45,
      departure_time: '12:30 PM',
      frequency: 'Daily',
      journey_duration: '1 hour 35 minutes',
      stops: [
        { stop_name: 'Surathkal', planned_arrival: '12:30 PM' },
        { stop_name: 'Mulki', planned_arrival: '12:55 PM' },
        { stop_name: 'Kaup', planned_arrival: '01:15 PM' },
        { stop_name: 'Kundapura', planned_arrival: '01:40 PM' },
        { stop_name: 'Udupi', planned_arrival: '02:05 PM' },
      ],
    },
  ]

  let remaining = rakeshBuses.length
  rakeshBuses.forEach((b) => {
    sqliteDb.get(
      'SELECT bus_id FROM buses WHERE UPPER(REPLACE(vehicle_number, " ", "-")) = ?',
      [b.vehicle_number],
      (err, row) => {
        if (!row) {
          sqliteDb.run(
            `INSERT INTO buses (
              bus_name, vehicle_number, route_number, service_type,
              origin, destination, is_last_bus, conductor_pin,
              owner_email, total_seats, photo_url, departure_time,
              frequency, journey_duration
            ) VALUES (?, ?, ?, ?, ?, ?, 0, '4509', 'rakesh@gmail.com', ?, '/images/coastal-private-bus.jpg', ?, ?, ?)`,
            [
              b.bus_name,
              b.vehicle_number,
              b.route_number,
              b.service_type,
              b.origin,
              b.destination,
              b.total_seats,
              b.departure_time,
              b.frequency,
              b.journey_duration,
            ],
            function (insErr) {
              if (!insErr) {
                const busId = this.lastID
                const stopStmt = sqliteDb.prepare(
                  'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES (?, ?, ?, ?)'
                )
                b.stops.forEach((s, idx) => {
                  stopStmt.run(busId, idx + 1, s.stop_name, s.planned_arrival)
                })
                stopStmt.finalize()
              }
              remaining--
              if (remaining <= 0 && cb) cb()
            }
          )
        } else {
          const busId = row.bus_id
          sqliteDb.run(
            'UPDATE buses SET bus_name = ?, service_type = ?, departure_time = ?, origin = ?, destination = ?, owner_email = "rakesh@gmail.com" WHERE bus_id = ?',
            [b.bus_name, b.service_type, b.departure_time, b.origin, b.destination, busId],
            () => {
              if (b.vehicle_number === 'KA-19-AB-1234' || b.vehicle_number === 'KA-20-CD-5678' || b.vehicle_number === 'KA-21-GH-3456') {
                sqliteDb.run('DELETE FROM bus_route_stops WHERE bus_id = ?', [busId], () => {
                  const stopStmt = sqliteDb.prepare(
                    'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES (?, ?, ?, ?)'
                  )
                  b.stops.forEach((s, idx) => {
                    stopStmt.run(busId, idx + 1, s.stop_name, s.planned_arrival)
                  })
                  stopStmt.finalize(() => {
                    remaining--
                    if (remaining <= 0 && cb) cb()
                  })
                })
              } else {
                remaining--
                if (remaining <= 0 && cb) cb()
              }
            }
          )
        }
      }
    )
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
export async function getBusById(busId, ownerEmail = null) {
  if (isPostgres()) {
    const query = ownerEmail
      ? 'SELECT * FROM buses WHERE bus_id = $1 AND LOWER(owner_email) = LOWER($2) LIMIT 1'
      : 'SELECT * FROM buses WHERE bus_id = $1 LIMIT 1'
    const params = ownerEmail ? [busId, ownerEmail] : [busId]
    const res = await pgPool.query(query, params)
    if (!res.rows || res.rows.length === 0) return null
    const bus = res.rows[0]
    const stops = await getBusRouteStops(busId)
    return { ...bus, stops }
  }

  return new Promise((resolve) => {
    const query = ownerEmail
      ? 'SELECT * FROM buses WHERE bus_id = ? AND LOWER(owner_email) = LOWER(?) LIMIT 1'
      : 'SELECT * FROM buses WHERE bus_id = ? LIMIT 1'
    const params = ownerEmail ? [busId, ownerEmail] : [busId]
    sqliteDb.get(query, params, async (err, row) => {
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

// 10. Save Bus (with multi-stop route using transactional persistence)
export async function saveBus(bus) {
  const cleanVeh = bus.vehicle_number.toUpperCase()
  const stops = Array.isArray(bus.stops) ? bus.stops : []

  if (isPostgres()) {
    const client = await pgPool.connect()
    try {
      await client.query('BEGIN')
      const ins = await client.query(
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
        await client.query(
          'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES ($1, $2, $3, $4)',
          [newBusId, idx + 1, stops[idx].stop_name || '', stops[idx].planned_arrival || '']
        )
      }

      await client.query('COMMIT')
      return { bus_id: newBusId, ...bus, stops }
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('Error inserting bus to PostgreSQL:', err.message)
      return null
    } finally {
      client.release()
    }
  }

  // SQLite Save Bus with transaction
  return new Promise((resolve) => {
    sqliteDb.serialize(() => {
      sqliteDb.run('BEGIN TRANSACTION')
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
            sqliteDb.run('ROLLBACK')
            resolve(null)
            return
          }

          const newBusId = this.lastID
          if (stops.length === 0) {
            sqliteDb.run('COMMIT')
            resolve({ bus_id: newBusId, ...bus, stops: [] })
            return
          }

          const stmt = sqliteDb.prepare(
            'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES (?, ?, ?, ?)'
          )
          stops.forEach((stop, idx) => {
            stmt.run(newBusId, idx + 1, stop.stop_name || '', stop.planned_arrival || '')
          })
          stmt.finalize((stmtErr) => {
            if (stmtErr) {
              sqliteDb.run('ROLLBACK')
              resolve(null)
            } else {
              sqliteDb.run('COMMIT')
              resolve({ bus_id: newBusId, ...bus, stops })
            }
          })
        }
      )
    })
  })
}

// 11. Update Bus (with multi-stop route using transactional persistence)
export async function updateBus(busId, bus) {
  const cleanVeh = bus.vehicle_number.toUpperCase()
  const stops = Array.isArray(bus.stops) ? bus.stops : []

  if (isPostgres()) {
    const client = await pgPool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE buses SET
          bus_name = $1,
          vehicle_number = $2,
          route_number = $3,
          service_type = $4,
          origin = $5,
          destination = $6,
          total_seats = $7,
          photo_url = $8,
          departure_time = $9,
          frequency = $10,
          journey_duration = $11
        WHERE bus_id = $12 AND LOWER(owner_email) = LOWER($13)`,
        [
          bus.bus_name,
          cleanVeh,
          bus.route_number || '001',
          bus.service_type || 'Express',
          bus.origin || 'Mangaluru',
          bus.destination || 'Udupi',
          bus.total_seats || 45,
          bus.photo_url || '/images/coastal-private-bus.jpg',
          bus.departure_time || '06:30 AM',
          bus.frequency || 'Daily',
          bus.journey_duration || '3 hours 30 minutes',
          busId,
          bus.owner_email,
        ]
      )

      await client.query('DELETE FROM bus_route_stops WHERE bus_id = $1', [busId])
      for (let idx = 0; idx < stops.length; idx++) {
        await client.query(
          'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES ($1, $2, $3, $4)',
          [busId, idx + 1, stops[idx].stop_name || '', stops[idx].planned_arrival || '']
        )
      }

      await client.query('COMMIT')
      return { bus_id: busId, ...bus, stops }
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('Error updating bus in PostgreSQL:', err.message)
      return null
    } finally {
      client.release()
    }
  }

  return new Promise((resolve) => {
    sqliteDb.serialize(() => {
      sqliteDb.run('BEGIN TRANSACTION')
      sqliteDb.run(
        `UPDATE buses SET
          bus_name = ?,
          vehicle_number = ?,
          route_number = ?,
          service_type = ?,
          origin = ?,
          destination = ?,
          total_seats = ?,
          photo_url = ?,
          departure_time = ?,
          frequency = ?,
          journey_duration = ?
        WHERE bus_id = ? AND LOWER(owner_email) = LOWER(?)`,
        [
          bus.bus_name,
          cleanVeh,
          bus.route_number || '001',
          bus.service_type || 'Express',
          bus.origin || 'Mangaluru',
          bus.destination || 'Udupi',
          bus.total_seats || 45,
          bus.photo_url || '/images/coastal-private-bus.jpg',
          bus.departure_time || '06:30 AM',
          bus.frequency || 'Daily',
          bus.journey_duration || '3 hours 30 minutes',
          busId,
          bus.owner_email,
        ],
        function (err) {
          if (err) {
            sqliteDb.run('ROLLBACK')
            return resolve(null)
          }
          sqliteDb.run('DELETE FROM bus_route_stops WHERE bus_id = ?', [busId], (delErr) => {
            if (delErr) {
              sqliteDb.run('ROLLBACK')
              return resolve(null)
            }
            if (stops.length === 0) {
              sqliteDb.run('COMMIT')
              return resolve({ bus_id: busId, ...bus, stops: [] })
            }
            const stmt = sqliteDb.prepare(
              'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES (?, ?, ?, ?)'
            )
            stops.forEach((stop, idx) => {
              stmt.run(busId, idx + 1, stop.stop_name || '', stop.planned_arrival || '')
            })
            stmt.finalize((stmtErr) => {
              if (stmtErr) {
                sqliteDb.run('ROLLBACK')
                resolve(null)
              } else {
                sqliteDb.run('COMMIT')
                resolve({ bus_id: busId, ...bus, stops })
              }
            })
          })
        }
      )
    })
  })
}

// 12. Update Conductor PIN
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

// 13. Delete Bus (with cascade cleanup inside transaction)
export async function deleteBus(busId, ownerEmail = null) {
  if (isPostgres()) {
    const client = await pgPool.connect()
    try {
      await client.query('BEGIN')
      if (ownerEmail) {
        const check = await client.query(
          'SELECT bus_id FROM buses WHERE bus_id = $1 AND LOWER(owner_email) = LOWER($2)',
          [busId, ownerEmail]
        )
        if (check.rowCount === 0) {
          await client.query('ROLLBACK')
          return false
        }
      }
      await client.query('UPDATE conductors SET assigned_bus_id = NULL WHERE assigned_bus_id = $1', [busId])
      await client.query('DELETE FROM bus_route_stops WHERE bus_id = $1', [busId])
      await client.query('DELETE FROM gps_telemetry WHERE bus_id = $1', [busId])
      const res = await client.query('DELETE FROM buses WHERE bus_id = $1', [busId])
      await client.query('COMMIT')
      return res.rowCount > 0
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('Error deleting bus in PostgreSQL:', err.message)
      return false
    } finally {
      client.release()
    }
  }

  return new Promise((resolve) => {
    sqliteDb.run('UPDATE conductors SET assigned_bus_id = NULL WHERE assigned_bus_id = ?', [busId], () => {
      sqliteDb.run('DELETE FROM bus_route_stops WHERE bus_id = ?', [busId], () => {
        const sql = ownerEmail
          ? 'DELETE FROM buses WHERE bus_id = ? AND LOWER(owner_email) = LOWER(?)'
          : 'DELETE FROM buses WHERE bus_id = ?'
        const params = ownerEmail ? [busId, ownerEmail] : [busId]
        sqliteDb.run(sql, params, function (err) {
          resolve(!err && this.changes > 0)
        })
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

export async function getConductorByPhoneAndOwner(ownerEmail, phone) {
  const cleanPhone = String(phone || '').replace(/\D/g, '')
  const tenDigitPhone = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone
  const query = `
    SELECT c.*, b.bus_name, b.vehicle_number, b.route_number, b.origin, b.destination, b.total_seats
    FROM conductors c
    LEFT JOIN buses b ON c.assigned_bus_id = b.bus_id
    WHERE LOWER(c.owner_email) = LOWER($1)
      AND (
        REPLACE(c.phone, ' ', '') = $2
        OR RIGHT(REPLACE(c.phone, ' ', ''), 10) = $3
      )
    LIMIT 1
  `
  if (isPostgres()) {
    const res = await pgPool.query(query, [ownerEmail, cleanPhone, tenDigitPhone])
    return res.rows[0] || null
  }

  const sqliteQuery = `
    SELECT c.*, b.bus_name, b.vehicle_number, b.route_number, b.origin, b.destination, b.total_seats
    FROM conductors c
    LEFT JOIN buses b ON c.assigned_bus_id = b.bus_id
    WHERE LOWER(c.owner_email) = LOWER(?)
      AND (
        REPLACE(c.phone, ' ', '') = ?
        OR SUBSTR(REPLACE(c.phone, ' ', ''), -10) = ?
      )
    LIMIT 1
  `
  return new Promise((resolve) => {
    sqliteDb.get(sqliteQuery, [ownerEmail, cleanPhone, tenDigitPhone], (err, row) => {
      resolve(err ? null : row || null)
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

// ============================================================================
// VERIFIED COASTAL STOPS & PASSENGER PORTAL DATA LAYER
// ============================================================================

export const VERIFIED_COASTAL_STOPS = [
  {
    stop_name: 'Mangaluru',
    stop_name_kn: 'ಮಂಗಳೂರು (ಸ್ಟೇಟ್‌ಬ್ಯಾಂಕ್)',
    alternative_names: 'Mangalore, Statebank, Hampankatta, Service Bus Stand, Central, Nehru Maidan',
    nearby_landmarks: 'DC Office, Town Hall, Nehru Maidan, Central Railway Station, Hampankatta Market',
    locality: 'Statebank, Mangaluru',
    latitude: 12.8633,
    longitude: 74.8385,
  },
  {
    stop_name: 'Hampankatta',
    stop_name_kn: 'ಹಂಪನಕಟ್ಟೆ',
    alternative_names: 'Hampankatte, University College, K.S. Rao Road, City Centre Mall',
    nearby_landmarks: 'City Centre Mall, University College, Milagres Church, Light House Hill',
    locality: 'Hampankatta, Mangaluru',
    latitude: 12.8718,
    longitude: 74.8430,
  },
  {
    stop_name: 'Pumpwell',
    stop_name_kn: 'ಪಂಪ್‌ವೆಲ್',
    alternative_names: 'Pumpwell Circle, Mahaveer Circle, Kankanady Bypass, Father Muller, Indiana Hospital',
    nearby_landmarks: 'Father Muller Hospital, KMC Hospital Ambedkar Circle, Indiana Hospital, Kankanady Railway Station',
    locality: 'Kankanady, Mangaluru',
    latitude: 12.8601,
    longitude: 74.8649,
  },
  {
    stop_name: 'Lalbagh',
    stop_name_kn: 'ಲಾಲ್‌ಬಾಗ್',
    alternative_names: 'Lalbagh Bus Stop, MCC, Ladyhill, Mangala Stadium, Bharath Mall',
    nearby_landmarks: 'Mangalore City Corporation, Mangala Stadium, Kudroli Gokarnanatheshwara Temple, Bharath Mall',
    locality: 'Lalbagh, Mangaluru',
    latitude: 12.8821,
    longitude: 74.8427,
  },
  {
    stop_name: 'Kuntikana',
    stop_name_kn: 'ಕುಂತಿಕಾನ',
    alternative_names: 'AJ Hospital Junction, Kuntikana Circle, Derebail Cross, AJ Hospital, AJ Dental College',
    nearby_landmarks: 'AJ Hospital & Research Centre, AJ Dental College, Kuntikana Flyover, Derebail Church',
    locality: 'Kuntikana, Mangaluru',
    latitude: 12.8988,
    longitude: 74.8512,
  },
  {
    stop_name: 'Kottara Chowki',
    stop_name_kn: 'ಕೊಟ್ಟಾರ ಚೌಕಿ',
    alternative_names: 'Kottara, Chowki Junction, Infosys Kottara, Urwa Stores',
    nearby_landmarks: 'Infosys Kottara, Highway Flyover, Derebail Konchady, Urwa Stores',
    locality: 'Kottara, Mangaluru',
    latitude: 12.9056,
    longitude: 74.8361,
  },
  {
    stop_name: 'Kuloor',
    stop_name_kn: 'ಕೂಳೂರು',
    alternative_names: 'Kuloor Bridge, Kuloor Junction, Gurupura River Bridge, Tannirbhavi Cross',
    nearby_landmarks: 'Kuloor Bridge, Panambur Cross, KIADB Industrial Area, Tannirbhavi Beach Cross',
    locality: 'Kuloor, Mangaluru',
    latitude: 12.9234,
    longitude: 74.8257,
  },
  {
    stop_name: 'Panambur',
    stop_name_kn: 'ಪಣಂಬೂರು',
    alternative_names: 'Panambur Beach Cross, NMPT Gate, New Mangalore Port, Panambur Beach',
    nearby_landmarks: 'New Mangalore Port Authority (NMPT), Panambur Beach, MCF Plant, Indian Coast Guard',
    locality: 'Panambur, Mangaluru',
    latitude: 12.9463,
    longitude: 74.8105,
  },
  {
    stop_name: 'Baikampady',
    stop_name_kn: 'ಬೈಕಂಪಾಡಿ',
    alternative_names: 'Baikampady Industrial Area, APMC Market Baikampady, Meenakaliya',
    nearby_landmarks: 'Baikampady Industrial Estate, APMC Yard, Meenakaliya Cross',
    locality: 'Baikampady, Mangaluru',
    latitude: 12.9691,
    longitude: 74.8052,
  },
  {
    stop_name: 'Kulai',
    stop_name_kn: 'ಕುಳಾಯಿ',
    alternative_names: 'Kulai Junction, Hosabettu Cross, Honnakatte, Chitrapura',
    nearby_landmarks: 'Kulai Temple, Honnakatte Junction, Chitrapura Beach Cross',
    locality: 'Kulai, Mangaluru',
    latitude: 12.9842,
    longitude: 74.8041,
  },
  {
    stop_name: 'Surathkal',
    stop_name_kn: 'ಸುರತ್ಕಲ್',
    alternative_names: 'Surathkal Bus Stand, NITK Surathkal, Surathkal Circle, NITK Beach, Govinda Dasa',
    nearby_landmarks: 'NITK Surathkal Engineering College, Surathkal Lighthouse, Govinda Dasa College, Surathkal Railway Station',
    locality: 'Surathkal',
    latitude: 13.0068,
    longitude: 74.7954,
  },
  {
    stop_name: 'Mukka',
    stop_name_kn: 'ಮುಕ್ಕ',
    alternative_names: 'Mukka Junction, Srinivas Hospital Mukka, Srinivas University, Mukka Beach',
    nearby_landmarks: 'Srinivas Hospital & Medical College, Mukka Beach, Haleyangadi Gate',
    locality: 'Mukka, Mangaluru',
    latitude: 13.0321,
    longitude: 74.7891,
  },
  {
    stop_name: 'Mulki',
    stop_name_kn: 'ಮುಲ್ಕಿ',
    alternative_names: 'Mulki Bus Stand, Mulki Car Street, Punaroor, Kateel Cross, Bappanadu',
    nearby_landmarks: 'Kateel Shri Durgaparameshwari Temple Cross, Bappanadu Shri Durgaparameshwari Temple, Shambhavi River Bridge, Mulki Railway Station',
    locality: 'Mulki',
    latitude: 13.0908,
    longitude: 74.7903,
  },
  {
    stop_name: 'Padubidri',
    stop_name_kn: 'ಪಡುಬಿದ್ರಿ',
    alternative_names: 'Padubidri Junction, Padubidre, Blue Flag Beach Cross, Suzlon',
    nearby_landmarks: 'Padubidri End Point Beach, Blue Flag Beach, Mahalingeshwara Temple, Suzlon Industrial Area',
    locality: 'Padubidri, Udupi',
    latitude: 13.1415,
    longitude: 74.7725,
  },
  {
    stop_name: 'Uchila',
    stop_name_kn: 'ಉಚ್ಚಿಲ',
    alternative_names: 'Uchila Junction, Uchila Mahalakshmi, Yermal Cross, Mogaveera Bhavana',
    nearby_landmarks: 'Shri Mahalakshmi Temple Uchila, Mogaveera Sabha Bhavana, Yermal Cross',
    locality: 'Uchila, Udupi',
    latitude: 13.1812,
    longitude: 74.7571,
  },
  {
    stop_name: 'Kaup',
    stop_name_kn: 'ಕಾಪು',
    alternative_names: 'Kapu, Kaup Light House Cross, Kaup Bus Stand, Marigudi, Hosa Marigudi',
    nearby_landmarks: 'Kaup Lighthouse & Beach, Sri Hosa Marigudi Temple, Hale Marigudi Temple, Vidyaniketan Group',
    locality: 'Kaup, Udupi',
    latitude: 13.2208,
    longitude: 74.7431,
  },
  {
    stop_name: 'Katapadi',
    stop_name_kn: 'ಕಟಪಾಡಿ',
    alternative_names: 'Katapady Junction, Shirva Cross, Mattu Beach Cross, Venkataramana Temple',
    nearby_landmarks: 'Katapadi Mattu Beach Cross, Shirva-Manipal Road Cross, Shree Venkataramana Temple',
    locality: 'Katapadi, Udupi',
    latitude: 13.2798,
    longitude: 74.7402,
  },
  {
    stop_name: 'Udupi',
    stop_name_kn: 'ಉಡುಪಿ',
    alternative_names: 'Udupi City Bus Stand, Udupi Service Bus Stand, Karavali Bypass, Manipal Cross, Sri Krishna Matha',
    nearby_landmarks: 'Sri Krishna Matha / Temple, City Bus Stand, Manipal MIT Cross (Tiger Circle), Udupi Railway Station (Indrali), MGM College',
    locality: 'Udupi Town',
    latitude: 13.3409,
    longitude: 74.7421,
  },
  {
    stop_name: 'Santhekatte',
    stop_name_kn: 'ಸಂತೆಕಟ್ಟೆ',
    alternative_names: 'Kallianpur Cross, Robosoft Junction, Santhekatte Circle, Milagres College',
    nearby_landmarks: 'Milagres College Kallianpur, Robosoft Technologies Campus, Mount Rosary Church',
    locality: 'Santhekatte, Udupi',
    latitude: 13.3765,
    longitude: 74.7335,
  },
  {
    stop_name: 'Brahmavara',
    stop_name_kn: 'ಬ್ರಹ್ಮಾವರ',
    alternative_names: 'Brahmavar Bus Stand, SMS College Cross, Barkur Cross',
    nearby_landmarks: 'SMS College Brahmavara, Barkur Cross, Agricultural Research Station, Holy Family Church',
    locality: 'Brahmavara, Udupi',
    latitude: 13.4326,
    longitude: 74.7472,
  },
  {
    stop_name: 'Saligrama',
    stop_name_kn: 'ಸಾಲಿಗ್ರಾಮ',
    alternative_names: 'Saligrama Temple Cross, Gundmi, Guru Narasimha Temple, Padu Kere',
    nearby_landmarks: 'Guru Narasimha Temple Saligrama, Kota Shivarama Karantha Theme Park, Padu Kere Beach Cross',
    locality: 'Saligrama, Udupi',
    latitude: 13.4831,
    longitude: 74.7381,
  },
  {
    stop_name: 'Kota',
    stop_name_kn: 'ಕೋಟ',
    alternative_names: 'Kota Bus Stand, Manuru Cross, Karantha Bhavana, Sea Walk',
    nearby_landmarks: 'Dr. Kota Shivarama Karantha Smrithi Bhavana, Amrutheshwari Temple, Kota Manuru Sea Walk',
    locality: 'Kota, Udupi',
    latitude: 13.5123,
    longitude: 74.7214,
  },
  {
    stop_name: 'Kundapura',
    stop_name_kn: 'ಕುಂದಾಪುರ',
    alternative_names: 'Kundapura Shastri Circle, Kundapur Old Bus Stand, Parijatha Cross, Kodi Sea Walk',
    nearby_landmarks: 'Shastri Circle, Kundapura KSRTC & Private Bus Terminal, Kodi Sea Walk Beach, Kundeshwara Temple, Kundapura Railway Station',
    locality: 'Kundapura',
    latitude: 13.6288,
    longitude: 74.6917,
  },
  {
    stop_name: 'kollur',
    stop_name_kn: 'ಕೊಲ್ಲೂರು',
    alternative_names: 'Kollur Mookambika Temple, Mookambika Bus Stand, Kodachadri Hills',
    nearby_landmarks: 'Sri Mookambika Temple, Kodachadri Hills Base, Souparnika River',
    locality: 'Kollur, Udupi',
    latitude: 13.8647,
    longitude: 74.8142,
  },
]

async function seedVerifiedBusStopsPg() {
  try {
    const res = await pgPool.query('SELECT COUNT(*) AS count FROM bus_stops')
    if (Number(res.rows[0].count) === 0) {
      for (const stop of VERIFIED_COASTAL_STOPS) {
        await pgPool.query(
          `INSERT INTO bus_stops (stop_name, stop_name_kn, alternative_names, nearby_landmarks, locality, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (stop_name) DO NOTHING`,
          [
            stop.stop_name,
            stop.stop_name_kn,
            stop.alternative_names,
            stop.nearby_landmarks,
            stop.locality,
            stop.latitude,
            stop.longitude,
          ]
        )
      }
    }
  } catch (err) {
    console.error('Error seeding verified stops in PostgreSQL:', err.message)
  }
}

function seedVerifiedBusStopsSqlite(cb) {
  sqliteDb.get('SELECT COUNT(*) AS count FROM bus_stops', (err, row) => {
    if (err || (row && row.count > 0)) {
      if (cb) cb()
      return
    }
    const stmt = sqliteDb.prepare(`
      INSERT OR IGNORE INTO bus_stops (stop_name, stop_name_kn, alternative_names, nearby_landmarks, locality, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const stop of VERIFIED_COASTAL_STOPS) {
      stmt.run(
        stop.stop_name,
        stop.stop_name_kn,
        stop.alternative_names,
        stop.nearby_landmarks,
        stop.locality,
        stop.latitude,
        stop.longitude
      )
    }
    stmt.finalize(() => {
      if (cb) cb()
    })
  })
}

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function normalizeStopSearchTerm(term) {
  if (!term) return ''
  const clean = term.trim().toLowerCase()
  if (clean === 'mangalore' || clean === 'statebank') return 'mangaluru'
  if (clean === 'kundapur') return 'kundapura'
  return clean
}

// 17. Search Bus Stops (by official name, Kannada name, alternative names, or nearby landmark)
export async function searchBusStops(query) {
  const q = (query || '').trim()
  if (!q) {
    return getAllBusStops()
  }

  if (isPostgres()) {
    const pattern = `%${q}%`
    const res = await pgPool.query(
      `SELECT * FROM bus_stops
       WHERE stop_name ILIKE $1
          OR stop_name_kn ILIKE $1
          OR alternative_names ILIKE $1
          OR nearby_landmarks ILIKE $1
          OR locality ILIKE $1
       ORDER BY stop_id ASC
       LIMIT 30`,
      [pattern]
    )
    return res.rows
  }

  return new Promise((resolve, reject) => {
    const pattern = `%${q}%`
    sqliteDb.all(
      `SELECT * FROM bus_stops
       WHERE stop_name LIKE ?
          OR stop_name_kn LIKE ?
          OR alternative_names LIKE ?
          OR nearby_landmarks LIKE ?
          OR locality LIKE ?
       ORDER BY stop_id ASC
       LIMIT 30`,
      [pattern, pattern, pattern, pattern, pattern],
      (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      }
    )
  })
}

// 18. Get Nearby Bus Stops (Optional On-Demand Location)
export async function getNearbyBusStops(latitude, longitude, radiusKm = 15) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (isNaN(lat) || isNaN(lng)) return []

  const stops = await getAllBusStops()
  const withDistance = stops.map((stop) => {
    const dist = calculateHaversineKm(lat, lng, stop.latitude, stop.longitude)
    return {
      ...stop,
      distance_km: Number(dist.toFixed(1)),
    }
  })

  withDistance.sort((a, b) => a.distance_km - b.distance_km)
  return withDistance.filter((s) => s.distance_km <= radiusKm).slice(0, 15)
}

// 19. Get All Verified Bus Stops
export async function getAllBusStops() {
  if (isPostgres()) {
    const res = await pgPool.query('SELECT * FROM bus_stops ORDER BY stop_id ASC')
    return res.rows
  }

  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM bus_stops ORDER BY stop_id ASC', (err, rows) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

// 20. Search Buses By Journey (Intermediate Stop Order Matching)
// CRITICAL: Absolutely NO ticket fare, ticket price, fees or payment fields anywhere
export async function searchBusesByJourney(fromQuery, toQuery, activeBuses = {}) {
  const cleanFrom = normalizeStopSearchTerm(fromQuery)
  const cleanTo = normalizeStopSearchTerm(toQuery)

  if (!cleanFrom || !cleanTo) {
    return []
  }

  const buses = await getBuses()
  const matched = []

  for (const bus of buses) {
    let stops = await getBusRouteStops(bus.bus_id)
    if (!stops || stops.length < 2) {
      // Fallback: If 0 route stops recorded in DB, infer from origin and destination
      if (bus.origin && bus.destination) {
        stops = [
          { stop_order: 1, stop_name: bus.origin, planned_arrival: bus.departure_time || '07:00 AM' },
          { stop_order: 2, stop_name: bus.destination, planned_arrival: '08:30 AM' },
        ]
      } else {
        continue
      }
    }

    const fromIdx = stops.findIndex((s) => {
      const name = normalizeStopSearchTerm(s.stop_name)
      return name === cleanFrom || name.includes(cleanFrom) || cleanFrom.includes(name)
    })

    const toIdx = stops.findIndex((s) => {
      const name = normalizeStopSearchTerm(s.stop_name)
      return name === cleanTo || name.includes(cleanTo) || cleanTo.includes(name)
    })

    // Journey Requirement: FROM occurs BEFORE TO along the same route
    if (fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
      const boardingStop = stops[fromIdx]
      const destinationStop = stops[toIdx]

      const activeData = activeBuses[bus.bus_id] || {}
      const now = Date.now()
      const lastTs = activeData.timestamp ? new Date(activeData.timestamp).getTime() : 0
      const isShiftActive = Boolean(activeData.is_on_shift || activeData.active_shift)
      const hasRecentGps = isShiftActive && now - lastTs < 120000
      const isStale = isShiftActive && lastTs > 0 && now - lastTs >= 120000

      let trackingStatus = 'NOT TRACKING'
      if (hasRecentGps) {
        trackingStatus = 'LIVE'
      } else if (isStale) {
        trackingStatus = 'LOCATION STALE'
      } else if (bus.departure_time) {
        trackingStatus = 'SCHEDULED'
      }

      let liveEtaMinutes = null
      if (trackingStatus === 'LIVE' && activeData.latitude && activeData.longitude) {
        const remainingStops = Math.max(1, toIdx - fromIdx)
        const speed = activeData.speed > 10 ? activeData.speed : 32
        liveEtaMinutes = Math.max(2, Math.round((remainingStops * 6 * 60) / speed))
      }

      matched.push({
        bus_id: bus.bus_id,
        bus_name: bus.bus_name,
        vehicle_number: bus.vehicle_number,
        route_number: bus.route_number,
        service_type: bus.service_type || 'Express',
        origin: bus.origin,
        destination: bus.destination,
        route_name: `${bus.origin} ➔ ${bus.destination}`,
        total_seats: bus.total_seats || 45,
        photo_url: bus.photo_url || null,
        boarding_stop: boardingStop.stop_name,
        boarding_stop_order: boardingStop.stop_order,
        boarding_planned_time: boardingStop.planned_arrival || bus.departure_time || '07:00 AM',
        destination_stop: destinationStop.stop_name,
        destination_stop_order: destinationStop.stop_order,
        destination_planned_time: destinationStop.planned_arrival || '08:30 AM',
        journey_duration: bus.journey_duration || '45 mins',
        tracking_status: trackingStatus,
        is_live: trackingStatus === 'LIVE',
        live_eta_minutes: liveEtaMinutes,
        last_update: activeData.timestamp ? new Date(activeData.timestamp).toLocaleTimeString() : null,
        latitude: activeData.latitude || null,
        longitude: activeData.longitude || null,
        speed: activeData.speed || 0,
        stops,
      })
    }
  }

  matched.sort((a, b) => {
    if (a.is_live && !b.is_live) return -1
    if (!a.is_live && b.is_live) return 1
    return (a.boarding_planned_time || '').localeCompare(b.boarding_planned_time || '')
  })

  return matched
}

// 21. Get Bus Route With Enriched Stops & Landmarks
export async function getBusRouteWithStops(busId) {
  const bus = await getBusById(busId)
  if (!bus) return null

  const routeStops = await getBusRouteStops(busId)
  const allVerified = await getAllBusStops()
  const map = {}
  allVerified.forEach((s) => {
    map[s.stop_name.toLowerCase()] = s
  })

  const enriched = (routeStops || []).map((s) => {
    const meta = map[s.stop_name.toLowerCase()] || {}
    return {
      ...s,
      stop_name_kn: meta.stop_name_kn || s.stop_name,
      nearby_landmarks: meta.nearby_landmarks || '',
      locality: meta.locality || '',
      latitude: meta.latitude || null,
      longitude: meta.longitude || null,
    }
  })

  return {
    ...bus,
    stops: enriched,
  }
}

// 22. Passenger Feedback Persistence
export async function savePassengerFeedback({ name, email, category, rating, message }) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('Feedback message is required.')
  }
  const cleanName = (name || 'Anonymous Passenger').trim().slice(0, 100)
  const cleanEmail = (email || '').trim().slice(0, 120)
  const cleanCategory = (category || 'General').trim().slice(0, 50)
  const cleanRating = Math.min(Math.max(Number(rating) || 5, 1), 5)
  const cleanMsg = message.trim().slice(0, 2000)

  if (isPostgres()) {
    const res = await pgPool.query(
      `INSERT INTO passenger_feedback (name, email, category, rating, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [cleanName, cleanEmail, cleanCategory, cleanRating, cleanMsg]
    )
    return {
      id: res.rows[0].id,
      name: cleanName,
      email: cleanEmail,
      category: cleanCategory,
      rating: cleanRating,
      message: cleanMsg,
      created_at: res.rows[0].created_at,
    }
  }

  return new Promise((resolve, reject) => {
    sqliteDb.run(
      `INSERT INTO passenger_feedback (name, email, category, rating, message) VALUES (?, ?, ?, ?, ?)`,
      [cleanName, cleanEmail, cleanCategory, cleanRating, cleanMsg],
      function (err) {
        if (err) reject(err)
        else {
          resolve({
            id: this.lastID,
            name: cleanName,
            email: cleanEmail,
            category: cleanCategory,
            rating: cleanRating,
            message: cleanMsg,
            created_at: new Date().toISOString(),
          })
        }
      }
    )
  })
}

// 23. Get Recent Passenger Feedback
export async function getPassengerFeedback(limit = 20) {
  const max = Math.min(Number(limit) || 20, 100)
  if (isPostgres()) {
    const res = await pgPool.query(
      'SELECT * FROM passenger_feedback ORDER BY created_at DESC LIMIT $1',
      [max]
    )
    return res.rows
  }

  return new Promise((resolve, reject) => {
    sqliteDb.all(
      'SELECT * FROM passenger_feedback ORDER BY created_at DESC LIMIT ?',
      [max],
      (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      }
    )
  })
}
