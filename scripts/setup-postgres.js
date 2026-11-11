import dotenv from 'dotenv'
import pg from 'pg'
import sqlite3 from 'sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqlitePath = path.resolve(__dirname, '..', 'transit.db')

const pgConfig = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: String(process.env.PGPASSWORD || ''),
}

const targetDb = process.env.PGDATABASE || 'karavali_transit'

async function setup() {
  console.log(`🔌 Connecting to PostgreSQL at ${pgConfig.host}:${pgConfig.port} as ${pgConfig.user}...`)

  // 1. Connect to default postgres DB to ensure targetDb exists
  const adminClient = new pg.Client({ ...pgConfig, database: 'postgres' })
  await adminClient.connect()
  console.log('✅ Connected to PostgreSQL server!')

  const checkDb = await adminClient.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [targetDb]
  )

  if (checkDb.rowCount === 0) {
    console.log(`🔨 Creating database "${targetDb}"...`)
    await adminClient.query(`CREATE DATABASE "${targetDb}"`)
    console.log(`✅ Database "${targetDb}" created!`)
  } else {
    console.log(`ℹ️ Database "${targetDb}" already exists.`)
  }
  await adminClient.end()

  // 2. Connect to the target DB
  const client = new pg.Client({ ...pgConfig, database: targetDb })
  await client.connect()
  console.log(`✅ Connected to database "${targetDb}"!`)

  // 3. Create Tables
  console.log('🔨 Creating tables in PostgreSQL...')

  await client.query(`
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
  console.log('✅ All 8 PostgreSQL tables created successfully!')

  // 4. Migrate Data from SQLite if PostgreSQL is empty
  const countRes = await client.query('SELECT COUNT(*) AS count FROM buses')
  const busCount = Number(countRes.rows[0].count)

  if (busCount === 0) {
    console.log('📦 Migrating fleet data from SQLite transit.db to PostgreSQL...')
    const sqliteDb = new sqlite3.Database(sqlitePath)

    await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM buses', async (err, buses) => {
        if (err) return reject(err)
        if (buses && buses.length > 0) {
          for (const b of buses) {
            await client.query(
              `INSERT INTO buses (
                bus_id, bus_name, vehicle_number, route_number, service_type,
                origin, destination, is_last_bus, conductor_pin, owner_email,
                total_seats, photo_url, departure_time, frequency, journey_duration
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              ON CONFLICT (vehicle_number) DO NOTHING`,
              [
                b.bus_id, b.bus_name, b.vehicle_number, b.route_number, b.service_type || 'Express',
                b.origin, b.destination, b.is_last_bus || 0, b.conductor_pin, b.owner_email || 'vishal@gmail.com',
                b.total_seats || 45, b.photo_url, b.departure_time || '06:30 AM', b.frequency || 'Daily', b.journey_duration || '35 minutes'
              ]
            )

            const stops = await new Promise((resStops) => {
              sqliteDb.all('SELECT * FROM bus_route_stops WHERE bus_id = ?', [b.bus_id], (sErr, rows) => {
                resStops(rows || [])
              })
            })

            for (const s of stops) {
              await client.query(
                'INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES ($1, $2, $3, $4)',
                [b.bus_id, s.stop_order, s.stop_name, s.planned_arrival]
              )
            }
          }
          console.log(`✅ Migrated ${buses.length} buses from SQLite to PostgreSQL!`)
          await client.query("SELECT setval(pg_get_serial_sequence('buses', 'bus_id'), coalesce(max(bus_id), 1)) FROM buses;")
        }
        resolve()
      })
    })

    sqliteDb.close()
  } else {
    console.log(`ℹ️ PostgreSQL already contains ${busCount} buses.`)
  }

  await client.end()
  console.log('🎉 PostgreSQL setup and migration complete!')
}

setup().catch((err) => {
  console.error('❌ PostgreSQL setup failed:', err.message)
  process.exit(1)
})
