import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3002,
    host: '0.0.0.0', // Bind to all interfaces so external access works
    allowedHosts: [
      'localhost',
      'quotes.mynodes.duckdns.org',
      '151.145.40.40'
    ]
  }
})
