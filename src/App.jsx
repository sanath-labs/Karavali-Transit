import { useState } from 'react'
export default function App() {
  const calculateDelay = (speed) => (speed < 25 ? 4 : 0)
  return <div><h1>Karavali Transit Telemetry Engine</h1></div>
}
