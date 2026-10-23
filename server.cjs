const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"]
  }
});

// Seed default coastal buses along NH-66 corridor (Mangaluru to Surathkal / Udupi)
const initialBuses = {
  1: {
    bus_id: 1,
    vehicle_number: 'KA-19-AB-4509',
    bus_name: 'Vishal Express',
    route_from: 'Mangaluru Statebank',
    route_to: 'Surathkal',
    route_name: 'Mangaluru Statebank ➔ Surathkal',
    route_number: '15',
    service_type: 'Express',
    conductor_pin: '4509',
    owner_email: 'vishal@gmail.com',
    latitude: 12.8997,
    longitude: 74.8530,
    speed: 38,
    delay_minutes: 4,
    eta_minutes: 3,
    crowd_status: 'Seats Available',
    is_last_bus: false,
    active_shift: null
  },
  2: {
    bus_id: 2,
    vehicle_number: 'KA-20-C-8812',
    bus_name: 'Canara Pinto Deluxe',
    route_from: 'Mangaluru Statebank',
    route_to: 'Udupi',
    route_name: 'Mangaluru Statebank ➔ Udupi',
    route_number: 'NH-66',
    service_type: 'Express',
    conductor_pin: '8812',
    owner_email: 'vishal@gmail.com',
    latitude: 12.9271,
    longitude: 74.8415,
    speed: 46,
    delay_minutes: 0,
    eta_minutes: 8,
    crowd_status: 'Standing Allowed',
    is_last_bus: false,
    active_shift: null
  },
  3: {
    bus_id: 3,
    vehicle_number: 'KA-19-F-3304',
    bus_name: 'Padmambika Local',
    route_from: 'Mangaluru Statebank',
    route_to: 'Kuloor',
    route_name: 'Mangaluru Statebank ➔ Kuloor',
    route_number: '21',
    service_type: 'City / Ordinary',
    conductor_pin: '3304',
    owner_email: 'vishal@gmail.com',
    latitude: 12.8850,
    longitude: 74.8450,
    speed: 28,
    delay_minutes: 0,
    eta_minutes: 14,
    crowd_status: 'Seats Available',
    is_last_bus: true,
    active_shift: null
  },
  4: {
    bus_id: 4,
    vehicle_number: 'KA-19-MC-1022',
    bus_name: 'Coastal Star City',
    route_from: 'Surathkal',
    route_to: 'Mangaluru Statebank',
    route_name: 'Surathkal ➔ Mangaluru Statebank',
    route_number: '15B',
    service_type: 'City / Ordinary',
    conductor_pin: '1022',
    owner_email: 'vishal@gmail.com',
    latitude: 12.9350,
    longitude: 74.8210,
    speed: 34,
    delay_minutes: 0,
    eta_minutes: 5,
    crowd_status: 'Seats Available',
    is_last_bus: false,
    active_shift: null
  }
};

// Store live bus telemetry in memory (Zomato-style instant relay)
let activeBuses = { ...initialBuses };
let activeOtps = {}; // { [email]: { otp: '123456', expiresAt: number, agency_name: string } }
let registeredOwners = {
  'vishal@gmail.com': { email: 'vishal@gmail.com', agency_name: 'Vishal Coastal Travels', registered_at: Date.now() }
};
let shifts = [];

// ==================== REST API ENDPOINTS ====================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    active_buses_count: Object.keys(activeBuses).length,
    registered_owners: Object.keys(registeredOwners).length
  });
});

app.get('/api/buses', (req, res) => {
  res.json(Object.values(activeBuses));
});

// 1. OWNER AUTHENTICATION: Send 6-Digit Email OTP
app.post('/api/owner/send-otp', (req, res) => {
  const { email, agency_name } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  // Generate random 6-digit OTP code (e.g., 584920)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  activeOtps[cleanEmail] = {
    otp,
    expiresAt,
    agency_name: agency_name || (registeredOwners[cleanEmail]?.agency_name) || 'Coastal Bus Line'
  };

  console.log(`\n======================================================`);
  console.log(`📧 [GMAIL OTP SIMULATION] Email sent to: ${cleanEmail}`);
  console.log(`🔐 6-DIGIT VERIFICATION CODE: ${otp}`);
  console.log(`⏰ Code valid for 10 minutes.`);
  console.log(`======================================================\n`);

  res.json({
    success: true,
    message: `6-Digit OTP code successfully dispatched to ${cleanEmail}. Check your inbox!`,
    preview_otp: otp // Provided so tester can test immediately without email setup
  });
});

// 2. OWNER AUTHENTICATION: Verify OTP & Issue Session
app.post('/api/owner/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, error: 'Email and OTP code are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();
  const record = activeOtps[cleanEmail];

  // Also accept master demo code '123456' for instant offline demonstration
  const isValid = (record && record.otp === cleanOtp && Date.now() <= record.expiresAt) || cleanOtp === '123456';

  if (!isValid) {
    return res.status(401).json({ success: false, error: 'Invalid or expired 6-digit OTP code. Please request a new code.' });
  }

  const agencyName = record?.agency_name || registeredOwners[cleanEmail]?.agency_name || 'Coastal Transit Owner';
  registeredOwners[cleanEmail] = {
    email: cleanEmail,
    agency_name: agencyName,
    last_login: Date.now()
  };

  delete activeOtps[cleanEmail];

  res.json({
    success: true,
    message: 'Identity verified successfully.',
    owner: {
      email: cleanEmail,
      agency_name: agencyName,
      token: `owner_token_${Date.now()}`
    }
  });
});

// 3. OWNER FLEET: Get all buses owned by this email
app.get('/api/owner/buses', (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  const ownerBuses = Object.values(activeBuses).filter(b => 
    !email || (b.owner_email && b.owner_email.toLowerCase() === email) || email === 'vishal@gmail.com'
  );
  res.json(ownerBuses);
});

// 4. OWNER FLEET: Add new bus to fleet with unique Secret PIN
app.post('/api/owner/buses', (req, res) => {
  const { owner_email, bus_name, vehicle_number, route_number, origin, destination, service_type, conductor_pin } = req.body;
  if (!bus_name || !vehicle_number) {
    return res.status(400).json({ success: false, error: 'Bus Name and Vehicle Number are required.' });
  }

  const cleanVeh = vehicle_number.trim().toUpperCase().replace(/\s+/g, '-');
  
  // Check if already registered
  const exists = Object.values(activeBuses).some(b => b.vehicle_number === cleanVeh);
  if (exists) {
    return res.status(409).json({ success: false, error: `Bus ${cleanVeh} is already registered in the system.` });
  }

  const newId = Date.now();
  const pin = conductor_pin ? String(conductor_pin).trim() : Math.floor(1000 + Math.random() * 9000).toString();

  const newBus = {
    bus_id: newId,
    vehicle_number: cleanVeh,
    bus_name: bus_name.trim(),
    route_from: origin || 'Mangaluru Statebank',
    route_to: destination || 'Surathkal',
    route_name: `${origin || 'Mangaluru Statebank'} ➔ ${destination || 'Surathkal'}`,
    route_number: route_number || '15',
    service_type: service_type || 'Express',
    conductor_pin: pin,
    owner_email: (owner_email || 'vishal@gmail.com').trim().toLowerCase(),
    latitude: 12.8718,
    longitude: 74.8430,
    speed: 0,
    delay_minutes: 0,
    eta_minutes: 3,
    crowd_status: 'Seats Available',
    is_last_bus: false,
    active_shift: null
  };

  activeBuses[newId] = newBus;

  // Broadcast to all clients
  io.emit('sync_buses', activeBuses);

  res.status(201).json({ success: true, bus: newBus });
});

// 5. OWNER FLEET: Update Secret Conductor PIN
app.patch('/api/owner/buses/:busId/pin', (req, res) => {
  const busId = req.params.busId;
  const { conductor_pin } = req.body;
  if (!conductor_pin) {
    return res.status(400).json({ success: false, error: 'conductor_pin is required' });
  }

  const bus = activeBuses[busId];
  if (!bus) {
    return res.status(404).json({ success: false, error: 'Bus not found.' });
  }

  bus.conductor_pin = String(conductor_pin).trim();
  res.json({ success: true, message: `Conductor PIN updated for ${bus.vehicle_number}`, bus });
});

// 6. OWNER FLEET: Delete Bus from Fleet
app.delete('/api/owner/buses/:busId', (req, res) => {
  const busId = req.params.busId;
  if (!activeBuses[busId]) {
    return res.status(404).json({ success: false, error: 'Bus not found' });
  }

  delete activeBuses[busId];
  io.emit('sync_buses', activeBuses);
  res.json({ success: true, message: 'Bus removed from fleet.' });
});

// 7. REAL-WORLD CONDUCTOR CHECK-IN: Verify Bus Number & Secret PIN
app.post('/api/conductor/verify-pin', (req, res) => {
  const { vehicle_number, conductor_pin, driver_phone } = req.body;
  if (!vehicle_number || !conductor_pin) {
    return res.status(400).json({ success: false, error: 'Bus registration number and Secret PIN are required.' });
  }

  const cleanVeh = vehicle_number.trim().toUpperCase().replace(/\s+/g, '-');
  const cleanPin = String(conductor_pin).trim();

  // Search active fleet
  const bus = Object.values(activeBuses).find(b => 
    b.vehicle_number.toUpperCase().replace(/\s+/g, '-') === cleanVeh
  );

  if (!bus) {
    return res.status(404).json({
      success: false,
      error: `Vehicle "${vehicle_number}" not found in registered fleet. Contact fleet owner.`
    });
  }

  const expectedPin = String(bus.conductor_pin || '4509').trim();

  if (cleanPin !== expectedPin && cleanPin !== '4509') { // Allow 4509 as master fallback
    return res.status(401).json({
      success: false,
      error: `Incorrect Secret PIN for ${bus.vehicle_number}. Ask owner for the 4-digit PIN.`
    });
  }

  const shiftData = {
    shift_id: Date.now(),
    driver_phone: driver_phone || '98451 23456',
    vehicle_number: bus.vehicle_number,
    bus_name: bus.bus_name,
    route_name: bus.route_name,
    start_time: new Date().toLocaleTimeString(),
    status: 'ACTIVE'
  };

  shifts.unshift(shiftData);
  bus.active_shift = shiftData;

  console.log(`✅ [Conductor Authenticated] Bus: ${bus.vehicle_number} (${bus.bus_name}) PIN Verified.`);

  res.json({
    success: true,
    message: `Authentication successful. Bus unlocked for conductor duty.`,
    bus,
    shift: shiftData
  });
});

app.get('/api/shifts', (req, res) => {
  res.json(shifts.slice(0, 15));
});

// ==================== WEBSOCKET RELAY ====================

io.on('connection', (socket) => {
  console.log(`[Connected] Client ID: ${socket.id}`);

  // Send current live buses immediately to newly connected passengers
  socket.emit('sync_buses', activeBuses);
  socket.emit('initial_buses', Object.values(activeBuses));

  // Conductor broadcasts GPS telemetry (Zomato-style in-memory relay)
  socket.on('update_location', (data) => {
    // Step 4: Speed Validation Check — Ignore unrealistic bus teleportation spikes
    if (data.speed && data.speed > 100) {
      console.warn(`[GPS Spike Rejected] Bus #${data.bus_id} reported impossible speed: ${data.speed} km/h`);
      return;
    }

    const payload = {
      ...(activeBuses[data.bus_id] || {}),
      ...data,
      timestamp: data.timestamp || Date.now()
    };

    activeBuses[data.bus_id] = payload;

    // Instantly broadcast to all connected passengers in milliseconds (Zomato-style push)
    io.emit('live_location_broadcast', payload);
    io.emit('bus_location_update', payload);
  });

  // Emergency / Traffic delay notifications
  socket.on('send_alert', (alertData) => {
    io.emit('emergency_alert', alertData);
  });

  socket.on('disconnect', () => {
    console.log(`[Disconnected] Client ID: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Karavali-Transit WebSocket Server running on http://localhost:${PORT}`);
});
