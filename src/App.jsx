import { useState } from 'react'
import io from 'socket.io-client'

const socket = io('http://localhost:5000')

export default function App() {
  const [role, setRole] = useState('passenger')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [busData, setBusData] = useState({
    bus_name: 'Vishal Express',
    route_name: 'Mangaluru Statebank ➔ Surathkal',
  })

  const handleStartShift = (e) => {
    e.preventDefault()
    setIsLoggedIn(true)
  }

  return (
    <div>
      <h1>Karavali Transit</h1>
      <button onClick={() => setRole('passenger')}>Passenger</button>
      <button onClick={() => setRole('conductor')}>Conductor</button>
    </div>
  )
}
