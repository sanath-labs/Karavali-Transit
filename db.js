import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sqlite3 from 'sqlite3'
import { matchesConductorPin } from './serverAuth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, 'transit.db')

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Could not connect to SQL database:', err.message)
  } else {
    console.log('✅ SQL Database connected: file:///' + dbPath.replace(/\\/g, '/'))
  }
})

let isConnected = false

export function isDbConnected() {
  return isConnected
}

// Initialize SQL Schema and Seed Initial Coastal Buses
export function initDB() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Buses Table
      db.run(`
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Add columns if table already existed without them
      db.run('ALTER TABLE buses ADD COLUMN conductor_pin TEXT', () => {})
      db.run("ALTER TABLE buses ADD COLUMN owner_email TEXT DEFAULT 'vishal@gmail.com'", () => {})

      // 2. Driver Shifts Table
      db.run(`
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

      // 3. Live GPS Telemetry Logs Table
      db.run(`
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

      // 4. Owners Table
      db.run(`
        CREATE TABLE IF NOT EXISTS owners (
          owner_id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          agency_name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // 5. Email OTPs Table
      db.run(`
        CREATE TABLE IF NOT EXISTS email_otps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          otp_code TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used INTEGER DEFAULT 0
        )
      `)

      // Seed Initial Coastal Karnataka Buses if empty
      db.get('SELECT COUNT(*) AS count FROM buses', (err, row) => {
        if (err) {
          console.error('Error checking buses table:', err.message)
          reject(err)
          return
        }

        if (row && row.count === 0) {
          const stmt = db.prepare(`
            INSERT INTO buses (bus_name, vehicle_number, route_number, service_type, origin, destination, is_last_bus, conductor_pin, owner_email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)

          stmt.run('Vishal Express', 'KA-19-AB-4509', '15', 'Express', 'Mangaluru Statebank', 'Surathkal', 0, '4509', 'vishal@gmail.com')
          stmt.run('Canara Pinto Deluxe', 'KA-20-C-8812', 'NH-66', 'Express', 'Mangaluru Statebank', 'Udupi', 0, '8812', 'vishal@gmail.com')
          stmt.run('Padmambika Local', 'KA-19-F-3304', '21', 'City / Ordinary', 'Mangaluru Statebank', 'Kuloor', 1, '3304', 'vishal@gmail.com')
          stmt.finalize(() => {
            console.log('✅ Seeded 3 coastal demo buses into SQL database (buses table)')
          })
        } else {
          // Ensure PINs exist on existing rows
          db.run("UPDATE buses SET conductor_pin = '4509' WHERE vehicle_number = 'KA-19-AB-4509' AND (conductor_pin IS NULL OR conductor_pin = '')")
          db.run("UPDATE buses SET conductor_pin = '8812' WHERE vehicle_number = 'KA-20-C-8812' AND (conductor_pin IS NULL OR conductor_pin = '')")
          db.run("UPDATE buses SET conductor_pin = '3304' WHERE vehicle_number = 'KA-19-F-3304' AND (conductor_pin IS NULL OR conductor_pin = '')")
          db.run("UPDATE buses SET owner_email = 'vishal@gmail.com' WHERE owner_email IS NULL OR owner_email = ''")
        }

        // Seed demo owner
        db.run("INSERT OR IGNORE INTO owners (email, agency_name) VALUES ('vishal@gmail.com', 'Vishal Coastal Travels')")

        isConnected = true
        console.log('✅ SQL Database initialized (tables: buses, driver_shifts, gps_telemetry, owners, email_otps)')
        resolve(true)
      })
    })
  })
}

// Insert Active Driver Shift
export function recordShift(data) {
  return new Promise((resolve) => {
    const query = `
      INSERT INTO driver_shifts (driver_phone, vehicle_number, bus_name, route_name)
      VALUES (?, ?, ?, ?)
    `
    db.run(
      query,
      [data.driver_phone, data.vehicle_number, data.bus_name, data.route_name],
      function (err) {
        if (err) {
          console.error('Error inserting shift to SQL:', err.message)
          resolve(null)
        } else {
          console.log(`🗄️ SQL: Driver shift recorded (ID: ${this.lastID})`)
          resolve({ shift_id: this.lastID, ...data })
        }
      }
    )
  })
}

// Log Real-Time GPS Telemetry Coordinates
export function recordTelemetry(data) {
  return new Promise((resolve) => {
    const query = `
      INSERT INTO gps_telemetry (bus_id, bus_name, latitude, longitude, speed, delay_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    db.run(
      query,
      [
        data.bus_id || 1,
        data.bus_name || 'Vishal Express',
        data.latitude,
        data.longitude,
        data.speed || 0,
        data.delay_minutes || 0,
      ],
      function (err) {
        if (err) {
          console.error('Error logging GPS telemetry to SQL:', err.message)
          resolve(null)
        } else {
          resolve(this.lastID)
        }
      }
    )
  })
}

// Fetch all registered buses from SQL
export function getBuses() {
  return new Promise((resolve) => {
    db.all('SELECT * FROM buses ORDER BY bus_id ASC', (err, rows) => {
      if (err) {
        console.error('Error fetching buses from SQL:', err.message)
        resolve([])
      } else {
        resolve(rows || [])
      }
    })
  })
}

// Fetch buses for a specific owner
export function getBusesByOwner(ownerEmail) {
  return new Promise((resolve) => {
    const query = 'SELECT * FROM buses WHERE LOWER(owner_email) = LOWER(?) ORDER BY bus_id ASC'
    db.all(query, [ownerEmail], (err, rows) => {
      if (err) {
        console.error('Error fetching buses by owner:', err.message)
        resolve([])
      } else {
        resolve(rows || [])
      }
    })
  })
}

export function getOwnerByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT email, agency_name FROM owners WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email],
      (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row || null)
        }
      }
    )
  })
}

// Verify Conductor PIN for Bus Number
export function verifyConductorPin(vehicleNumber, pin) {
  return new Promise((resolve) => {
    const normalized = vehicleNumber.replace(/\s+/g, '-').toUpperCase()
    const query = 'SELECT * FROM buses WHERE UPPER(REPLACE(vehicle_number, " ", "-")) = ? LIMIT 1'
    db.get(query, [normalized], (err, row) => {
      if (err) {
        console.error('Error verifying conductor PIN:', err.message)
        resolve({ success: false, error: 'Unable to verify conductor PIN.' })
        return
      }
      if (!row) {
        resolve({ success: false, error: 'Vehicle number not found in registered fleet.' })
        return
      }

      if (matchesConductorPin(row.conductor_pin, pin)) {
        resolve({ success: true, bus: row })
      } else {
        resolve({ success: false, error: 'Incorrect Secret PIN for ' + row.vehicle_number })
      }
    })
  })
}

// Add or update bus in database
export function saveBus(bus) {
  return new Promise((resolve) => {
    const query = `
      INSERT INTO buses (bus_name, vehicle_number, route_number, service_type, origin, destination, is_last_bus, conductor_pin, owner_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    db.run(
      query,
      [
        bus.bus_name,
        bus.vehicle_number.toUpperCase(),
        bus.route_number,
        bus.service_type || 'Express',
        bus.origin || 'Mangaluru Statebank',
        bus.destination || 'Surathkal',
        bus.is_last_bus ? 1 : 0,
        bus.conductor_pin || null,
        bus.owner_email || 'vishal@gmail.com',
      ],
      function (err) {
        if (err) {
          console.error('Error inserting bus:', err.message)
          resolve(null)
        } else {
          resolve({ bus_id: this.lastID, ...bus })
        }
      }
    )
  })
}

// Update Bus Conductor PIN
export function updateBusPin(busId, pin) {
  return new Promise((resolve) => {
    const query = 'UPDATE buses SET conductor_pin = ? WHERE bus_id = ?'
    db.run(query, [pin, busId], function (err) {
      if (err) {
        resolve(false)
      } else {
        resolve(this.changes > 0)
      }
    })
  })
}

// Delete bus from database
export function deleteBus(busId) {
  return new Promise((resolve) => {
    db.run('DELETE FROM buses WHERE bus_id = ?', [busId], function (err) {
      resolve(!err && this.changes > 0)
    })
  })
}

// Fetch recent GPS telemetry records
export function getRecentTelemetry(limit = 20) {
  return new Promise((resolve) => {
    db.all('SELECT * FROM gps_telemetry ORDER BY log_id DESC LIMIT ?', [limit], (err, rows) => {
      if (err) {
        console.error('Error fetching telemetry from SQL:', err.message)
        resolve([])
      } else {
        resolve(rows || [])
      }
    })
  })
}

// Fetch active driver shifts
export function getActiveShifts() {
  return new Promise((resolve) => {
    db.all('SELECT * FROM driver_shifts ORDER BY shift_id DESC LIMIT 10', (err, rows) => {
      if (err) {
        console.error('Error fetching shifts from SQL:', err.message)
        resolve([])
      } else {
        resolve(rows || [])
      }
    })
  })
}
