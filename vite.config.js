import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
      '/socket.io': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet') || id.includes('react-leaflet')) {
              return 'vendor-maps'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons'
            }
            if (id.includes('socket.io-client')) {
              return 'vendor-socket'
            }
            return 'vendor-core'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
