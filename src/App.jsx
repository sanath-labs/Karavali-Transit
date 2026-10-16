import { useState } from 'react'
export default function App() {
  const [alerts, setAlerts] = useState([
    { id: 1, message: 'Notice: NH-66 Coastal Corridor live GPS tracking active.' }
  ])
  return <div><h1>Karavali Transit Passenger Advisory</h1></div>
}
