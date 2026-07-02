import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://<user>.github.io/NHQI-Tracking/ — assets must resolve
  // under that subpath rather than the domain root.
  base: '/NHQI-Tracking/',
  plugins: [react(), tailwindcss()],
})
