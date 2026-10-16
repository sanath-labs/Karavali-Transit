import { useState, useRef } from 'react'
import io from 'socket.io-client'

const socket = io('http://localhost:5000')

export default function App() {
  const [role, setRole] = useState('passenger')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const watchId = useRef(null)

  const handleStartShift = (e) => {
    e.preventDefault()
    if ('geolocation' in navigator) {
      watchId.current = navigator.geolocation.watchPosition((pos) => {
        socket.emit('update_location', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed
        })
      })
    }
    setIsLoggedIn(true)
  }

  return <div><h1>Karavali Transit</h1></div>
}
