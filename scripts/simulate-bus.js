/**
 * scripts/simulate-bus.js
 * CLI simulator to broadcast live bus GPS movements over Socket.IO.
 */
import io from 'socket.io-client'

const socket = io('http://localhost:5000')

const waypoints = [
  { name: 'Statebank (Terminal)', lat: 12.8718, lng: 74.8430, speed: 32 },
  { name: 'Hampankatta', lat: 12.8850, lng: 74.8450, speed: 28 },
  { name: 'Lalbagh', lat: 12.8970, lng: 74.8480, speed: 35 },
  { name: 'Nanthoor Jn', lat: 12.8997, lng: 74.8530, speed: 18 },
  { name: 'Kuloor Bridge', lat: 12.9271, lng: 74.8415, speed: 45 },
  { name: 'Baikampady', lat: 12.9350, lng: 74.8210, speed: 40 },
  { name: 'Surathkal Bus Stand', lat: 12.9472, lng: 74.7963, speed: 25 },
]

socket.on('connect', () => {
  console.log('🚍 Connected to Karavali-Transit telemetry hub!')
  let index = 0

  const interval = setInterval(() => {
    if (index >= waypoints.length) {
      console.log('🏁 Route simulation complete. Terminating.')
      clearInterval(interval)
      socket.disconnect()
      process.exit(0)
    }

    const point = waypoints[index]
    const payload = {
      bus_id: 1,
      bus_name: 'Vishal Express (Simulated)',
      vehicle_number: 'KA-20-AB-4509',
      route_name: 'Mangaluru Statebank ➔ Surathkal',
      latitude: point.lat,
      longitude: point.lng,
      speed: point.speed,
      crowd_status: point.speed < 25 ? 'Crowded (Standees)' : 'Seats Available',
      is_last_bus: false,
    }

    console.log(`📍 [${index + 1}/${waypoints.length}] Broadcasting at ${point.name} (${point.lat}, ${point.lng}) @ ${point.speed} km/h`)
    socket.emit('update_location', payload)
    index++
  }, 2000)
})

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message)
  process.exit(1)
})

