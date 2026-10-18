const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Seed default coastal buses along NH-66 corridor (Mangaluru to Surathkal / Udupi)
const initialBuses = {
  1: {
    bus_id: 1,
    vehicle_number: 'KA-20-AB-4509',
    bus_name: 'Vishal Express',
    route_from: 'Mangaluru Statebank',
    route_to: 'Surathkal',
    route_name: 'Mangaluru Statebank ➔ Surathkal',
    route_number: 'Route 16A (Express)',
    latitude: 12.8997,
    longitude: 74.8530,
    speed: 38,
    delay_minutes: 4,
    eta_minutes: 3,
    crowd_status: 'Seats Available',
    is_last_bus: false
  },
  2: {
    bus_id: 2,
    vehicle_number: 'KA-20-C-8812',
    bus_name: 'Canara Pinto Deluxe',
    route_from: 'Mangaluru Statebank',
    route_to: 'Udupi',
    route_name: 'Mangaluru Statebank ➔ Udupi',
    route_number: 'Route NH-66 (Express)',
    latitude: 12.9271,
    longitude: 74.8415,
    speed: 46,
    delay_minutes: 0,
    eta_minutes: 8,
    crowd_status: 'Standing Allowed',
    is_last_bus: false
  },
  3: {
    bus_id: 3,
    vehicle_number: 'KA-19-F-3304',
    bus_name: 'Padmambika Local',
    route_from: 'Mangaluru Statebank',
    route_to: 'Kuloor',
    route_name: 'Mangaluru Statebank ➔ Kuloor',
    route_number: 'Route 21 (Ordinary)',
    latitude: 12.8850,
    longitude: 74.8450,
    speed: 28,
    delay_minutes: 0,
    eta_minutes: 14,
    crowd_status: 'Seats Available',
    is_last_bus: true
  },
  4: {
    bus_id: 4,
    vehicle_number: 'KA-19-MC-1022',
    bus_name: 'Coastal Star City',
    route_from: 'Surathkal',
    route_to: 'Mangaluru Statebank',
    route_name: 'Surathkal ➔ Mangaluru Statebank',
    route_number: 'Route 15B (Ordinary)',
    latitude: 12.9350,
    longitude: 74.8210,
    speed: 34,
    delay_minutes: 0,
    eta_minutes: 5,
    crowd_status: 'Seats Available',
    is_last_bus: false
  }
};

// Store live bus telemetry in memory (Zomato-style instant relay)
let activeBuses = { ...initialBuses };

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', active_buses_count: Object.keys(activeBuses).length });
});

app.get('/api/buses', (req, res) => {
  res.json(Object.values(activeBuses));
});

io.on('connection', (socket) => {
  console.log(`[Connected] Client ID: ${socket.id}`);

  // Send current live buses immediately to newly connected passengers
  socket.emit('sync_buses', activeBuses);
  socket.emit('initial_buses', Object.values(activeBuses));

  // Conductor broadcasts GPS telemetry
  socket.on('update_location', (data) => {
    activeBuses[data.bus_id] = data;
    // Broadcast instantly to all connected passengers
    io.emit('live_location_broadcast', data);
    io.emit('bus_location_update', data);
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
