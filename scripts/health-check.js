/**
 * scripts/health-check.js
 * Verification CLI utility for the Karavali-Transit platform.
 */
import http from 'node:http'

const BACKEND_URL = 'http://localhost:5000/api/health'

console.log('🚍 Checking Karavali-Transit Central Fleet Server...')

const req = http.get(BACKEND_URL, (res) => {
  let rawData = ''
  res.on('data', (chunk) => { rawData += chunk })
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(rawData)
      console.log('✅ Health check passed!')
      console.log('Response:', parsedData)
      process.exit(0)
    } catch (e) {
      console.error('❌ Failed to parse response:', e.message)
      process.exit(1)
    }
  })
})

req.on('error', (e) => {
  console.error(`❌ Health check connection failed: ${e.message}`)
  console.log('💡 Ensure `node server.js` is running on port 5000.')
  process.exit(1)
})
