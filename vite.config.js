import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://<user>.github.io/NHQI-Tracking/ — assets must resolve
  // under that subpath rather than the domain root.
  base: '/NHQI-Tracking/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Main bundle includes the 571-facility dataset and exceeds Workbox's
        // default 2 MiB precache limit.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'NHQI Multi-Facility Tracker',
        short_name: 'NHQI Tracker',
        description: 'Track NY DOH Nursing Home Quality Initiative scores across facilities.',
        theme_color: '#0d9488',
        background_color: '#fafaf9',
        display: 'standalone',
        start_url: '/NHQI-Tracking/',
        scope: '/NHQI-Tracking/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
