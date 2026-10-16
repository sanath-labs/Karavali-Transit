import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', service: 'Karavali-Transit API' })
})

const server = createServer(app)
const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log(\Server running on http://localhost:\\)
})
