import { useState, useRef } from 'react'
import io from 'socket.io-client'

const socket = io('http://localhost:5000')

export default function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [destinationFilter, setDestinationFilter] = useState('All')
  return <div><h1>Karavali Transit Passenger Radar</h1></div>
}
