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
          total_seats INTEGER DEFAULT 45,
          photo_url TEXT,
          departure_time TEXT,
          frequency TEXT DEFAULT 'Daily',
          journey_duration TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Add columns if table already existed without them
      db.run('ALTER TABLE buses ADD COLUMN conductor_pin TEXT', () => {})
      db.run("ALTER TABLE buses ADD COLUMN owner_email TEXT DEFAULT 'vishal@gmail.com'", () => {})
      db.run('ALTER TABLE buses ADD COLUMN total_seats INTEGER DEFAULT 45', () => {})
      db.run('ALTER TABLE buses ADD COLUMN photo_url TEXT', () => {})
      db.run('ALTER TABLE buses ADD COLUMN departure_time TEXT', () => {})
      db.run("ALTER TABLE buses ADD COLUMN frequency TEXT DEFAULT 'Daily'", () => {})
      db.run('ALTER TABLE buses ADD COLUMN journey_duration TEXT', () => {})

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

      // 6. Bus Route Stops Table
      db.run(`
        CREATE TABLE IF NOT EXISTS bus_route_stops (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bus_id INTEGER NOT NULL,
          stop_order INTEGER NOT NULL,
          stop_name TEXT NOT NULL,
          planned_arrival TEXT NOT NULL,
          FOREIGN KEY (bus_id) REFERENCES buses(bus_id) ON DELETE CASCADE
        )
      `)

      // 7. Conductors Table
      db.run(`
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

      // 8. Owner Activities Table
      db.run(`
        CREATE TABLE IF NOT EXISTS owner_activities (
          activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_email TEXT NOT NULL,
          action_type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            INSERT INTO buses (bus_name, vehicle_number, route_number, service_type, origin, destination, is_last_bus, conductor_pin, owner_email, total_seats, departure_time, frequency, journey_duration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)

          stmt.run('Vishal Express', 'KA-19-AB-4509', '15', 'Express', 'Mangaluru', 'Surathkal', 0, '4509', 'vishal@gmail.com', 45, '06:30 AM', 'Daily', '35 minutes')
          stmt.run('Canara Pinto Deluxe', 'KA-20-C-8812', 'NH-66', 'Express', 'Mangaluru', 'Udupi', 0, '8812', 'vishal@gmail.com', 50, '07:15 AM', 'Daily', '1 hour 45 minutes')
          stmt.run('Padmambika Local', 'KA-19-F-3304', '21', 'City / Ordinary', 'Mangaluru', 'Kuloor', 1, '3304', 'vishal@gmail.com', 40, '08:00 AM', 'Daily', '30 minutes')
          stmt.finalize(() => {
            console.log('✅ Seeded 3 coastal demo buses into SQL database (buses table)')
            seedDefaultStops()
          })
        } else {
          // Ensure PINs and owner emails exist on existing rows
          db.run("UPDATE buses SET conductor_pin = '4509' WHERE vehicle_number = 'KA-19-AB-4509' AND (conductor_pin IS NULL OR conductor_pin = '')")
          db.run("UPDATE buses SET conductor_pin = '8812' WHERE vehicle_number = 'KA-20-C-8812' AND (conductor_pin IS NULL OR conductor_pin = '')")
          db.run("UPDATE buses SET conductor_pin = '3304' WHERE vehicle_number = 'KA-19-F-3304' AND (conductor_pin IS NULL OR conductor_pin = '')")
          db.run("UPDATE buses SET owner_email = 'vishal@gmail.com' WHERE owner_email IS NULL OR owner_email = ''")
          seedDefaultStops()
        }

        // Seed demo owners
        db.run("INSERT OR IGNORE INTO owners (email, agency_name) VALUES ('vishal@gmail.com', 'Vishal Coastal Travels')")
        db.run("INSERT OR IGNORE INTO owners (email, agency_name) VALUES ('rakesh@gmail.com', 'Rakesh Shetty Travels')")

        // Seed conductors if empty
        db.get('SELECT COUNT(*) AS count FROM conductors', (_, condRow) => {
          if (condRow && condRow.count === 0) {
            const condStmt = db.prepare('INSERT INTO conductors (owner_email, name, phone, assigned_bus_id) VALUES (?, ?, ?, ?)')
            condStmt.run('vishal@gmail.com', 'Manjunath', '98451 12345', 1)
            condStmt.run('vishal@gmail.com', 'Santhosh', '98452 23456', 2)
            condStmt.run('vishal@gmail.com', 'Suresh', '98453 34567', 3)
            condStmt.run('vishal@gmail.com', 'Ramesh', '98454 45678', null)
            condStmt.run('vishal@gmail.com', 'Praveen', '98455 56789', null)
            condStmt.run('rakesh@gmail.com', 'Manjunath', '98451 12345', 1)
            condStmt.run('rakesh@gmail.com', 'Santhosh', '98452 23456', 2)
            condStmt.run('rakesh@gmail.com', 'Suresh', '98453 34567', 3)
            condStmt.run('rakesh@gmail.com', 'Ramesh', '98454 45678', null)
            condStmt.run('rakesh@gmail.com', 'Praveen', '98455 56789', null)
            condStmt.finalize()
          }
        })

        // Seed activities if empty
        db.get('SELECT COUNT(*) AS count FROM owner_activities', (_, actRow) => {
          if (actRow && actRow.count === 0) {
            const actStmt = db.prepare('INSERT INTO owner_activities (owner_email, action_type, title, description, created_at) VALUES (?, ?, ?, ?, datetime("now", ?))')
            actStmt.run('vishal@gmail.com', 'bus_added', 'Bus KA 19 AB 1234 added', 'Added Shri Durga Prasad to fleet', '-2 hours')
            actStmt.run('vishal@gmail.com', 'conductor_assigned', 'Conductor Manjunath assigned', 'Assigned to Vishal Express', '-4 hours')
            actStmt.run('vishal@gmail.com', 'route_updated', 'Route Mangaluru - Udupi updated', 'Timetable synced', '-6 hours')
            actStmt.run('rakesh@gmail.com', 'bus_added', 'Bus KA 19 AB 1234 added', 'Added Shri Durga Prasad to fleet', '-2 hours')
            actStmt.run('rakesh@gmail.com', 'conductor_assigned', 'Conductor Manjunath assigned', 'Assigned to Vishal Express', '-4 hours')
            actStmt.run('rakesh@gmail.com', 'route_updated', 'Route Mangaluru - Udupi updated', 'Timetable synced', '-6 hours')
            actStmt.finalize()
          }
        })

        isConnected = true
        console.log('✅ SQL Database initialized (tables: buses, driver_shifts, gps_telemetry, owners, email_otps, bus_route_stops, conductors, owner_activities)')
        resolve(true)
      })
    })
  })
}

function seedDefaultStops() {
  db.get('SELECT COUNT(*) AS count FROM bus_route_stops', (_, row) => {
    if (row && row.count === 0) {
      const stopStmt = db.prepare('INSERT INTO bus_route_stops (bus_id, stop_order, stop_name, planned_arrival) VALUES (?, ?, ?, ?)')
      // Stops for Bus 1 (Mangaluru to Udupi corridor)
      stopStmt.run(1, 1, 'Mangaluru', '06:30 AM')
      stopStmt.run(1, 2, 'Surathkal', '07:05 AM')
      stopStmt.run(1, 3, 'Kundapura', '09:00 AM')
      stopStmt.run(1, 4, 'Udupi', '10:00 AM')

      // Stops for Bus 2
      stopStmt.run(2, 1, 'Mangaluru', '07:15 AM')
      stopStmt.run(2, 2, 'Kuloor', '07:35 AM')
      stopStmt.run(2, 3, 'Surathkal', '08:00 AM')
      stopStmt.run(2, 4, 'Udupi', '09:15 AM')

      // Stops for Bus 3
      stopStmt.run(3, 1, 'Mangaluru', '08:00 AM')
      stopStmt.run(3, 2, 'Urwa Market', '08:15 AM')
      stopStmt.run(3, 3, 'Kuloor', '08:35 AM')
      stopStmt.finalize()
    }
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

// Fetch route stops for a specific bus
export function getBusRouteStops(busId) {
  return new Promise((resolve) => {
    db.all(
      'SELECT stop_order, stop_name, planned_arrival FROM bus_route_stops WHERE bus_id = ? ORDER BY stop_order ASC',
      [busId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching stops for bus:', err.message)
          resolve([])
        } else {
          resolve(rows || [])
        }
      }
    )
  })
}

// Fetch buses for a specific owner, including route stops
export function getBusesByOwner(ownerEmail) {
  return new Promise((resolve) => {
    const query = 'SELECT * FROM buses WHERE LOWER(owner_email) = LOWER(?) ORDER BY bus_id ASC'
    db.all(query, [ownerEmail], async (err, rows) => {
      if (err || !rows) {
        console.error('Error fetching buses by owner:', err?.message)
        resolve([])
        return
      }

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

export function createOwner(email, agencyName) {
  return new Promise((resolve) => {
    db.run(
      'INSERT OR IGNORE INTO owners (email, agency_name) VALUES (?, ?)',
      [email.toLowerCase(), agencyName],
      function (err) {
        if (err) {
          console.error('Error inserting owner:', err.message)
          resolve(false)
        } else {
          resolve(true)
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

// Add or update bus in database along with route stops
export function saveBus(bus) {
  return new Promise((resolve) => {
    const query = `
      INSERT INTO buses (
        bus_name, vehicle_number, route_number, service_type,
        origin, destination, is_last_bus, conductor_pin,
        owner_email, total_seats, photo_url, departure_time,
        frequency, journey_duration
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    db.run(
      query,
      [
        bus.bus_name,
        bus.vehicle_number.toUpperCase(),
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
          console.error('Error inserting bus:', err.message)
          resolve(null)
          return
        }

        const newBusId = this.lastID
        const stops = Array.isArray(bus.stops) ? bus.stops : []

        if (stops.length === 0) {
          resolve({ bus_id: newBusId, ...bus, stops: [] })
          return
        }

        const stmt = db.prepare(
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

// Delete bus and associated stops from database
export function deleteBus(busId) {
  return new Promise((resolve) => {
    db.run('DELETE FROM bus_route_stops WHERE bus_id = ?', [busId], () => {
      db.run('DELETE FROM buses WHERE bus_id = ?', [busId], function (err) {
        resolve(!err && this.changes > 0)
      })
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

// Conductor Management
export function getConductorsByOwner(ownerEmail) {
  return new Promise((resolve) => {
    const query = `
      SELECT c.*, b.bus_name, b.vehicle_number
      FROM conductors c
      LEFT JOIN buses b ON c.assigned_bus_id = b.bus_id
      WHERE LOWER(c.owner_email) = LOWER(?)
      ORDER BY c.conductor_id DESC
    `
    db.all(query, [ownerEmail], (err, rows) => {
      if (err) {
        console.error('Error fetching conductors:', err.message)
        resolve([])
      } else {
        resolve(rows || [])
      }
    })
  })
}

export function saveConductor(data) {
  return new Promise((resolve) => {
    const query = `
      INSERT INTO conductors (owner_email, name, phone, assigned_bus_id, status)
      VALUES (?, ?, ?, ?, ?)
    `
    db.run(
      query,
      [data.owner_email, data.name, data.phone, data.assigned_bus_id || null, data.status || 'Active'],
      function (err) {
        if (err) {
          console.error('Error saving conductor:', err.message)
          resolve(null)
        } else {
          resolve({ conductor_id: this.lastID, ...data })
        }
      }
    )
  })
}

export function deleteConductor(conductorId, ownerEmail) {
  return new Promise((resolve) => {
    db.run(
      'DELETE FROM conductors WHERE conductor_id = ? AND LOWER(owner_email) = LOWER(?)',
      [conductorId, ownerEmail],
      function (err) {
        resolve(!err && this.changes > 0)
      }
    )
  })
}

// Owner Activities Logging
export function getOwnerActivities(ownerEmail, limit = 10) {
  return new Promise((resolve) => {
    db.all(
      'SELECT * FROM owner_activities WHERE LOWER(owner_email) = LOWER(?) ORDER BY activity_id DESC LIMIT ?',
      [ownerEmail, limit],
      (err, rows) => {
        if (err) {
          console.error('Error fetching activities:', err.message)
          resolve([])
        } else {
          resolve(rows || [])
        }
      }
    )
  })
}

export function insertOwnerActivity(ownerEmail, actionType, title, description = '') {
  return new Promise((resolve) => {
    db.run(
      'INSERT INTO owner_activities (owner_email, action_type, title, description) VALUES (?, ?, ?, ?)',
      [ownerEmail, actionType, title, description],
      function (err) {
        if (err) {
          console.error('Error inserting activity:', err.message)
          resolve(null)
        } else {
          resolve(this.lastID)
        }
      }
    )
  })
}

// Aggregate Dashboard Data for Owner
export async function getOwnerDashboardData(ownerEmail, activeBuses = {}) {
  const buses = await getBusesByOwner(ownerEmail)
  const conductors = await getConductorsByOwner(ownerEmail)
  const activities = await getOwnerActivities(ownerEmail, 10)

  const distinctRoutes = new Set(buses.map((b) => b.route_number).filter(Boolean))
  const liveCount = buses.filter((b) => {
    const active = activeBuses[b.bus_id]
    return active && (active.speed > 0 || active.active_shift)
  }).length

  return {
    stats: {
      total_buses: buses.length,
      total_conductors: conductors.length,
      total_routes: distinctRoutes.size || (buses.length > 0 ? 1 : 0),
      live_buses: liveCount,
    },
    recent_activity: activities,
    buses,
    conductors,
  }
}
