import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config for the forensic frontend.
// Dev server runs on 5173 and talks to the FastAPI backend on 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
