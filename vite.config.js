import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from two places: GitHub Pages under a /NHQI-Tracking/ subpath, and
// optionally a second static host (Netlify, Vercel, etc.) at its domain root.
// Routing itself doesn't care (App.jsx uses HashRouter — no server rewrite
// rules needed either way), but asset URLs and the PWA manifest do need the
// right base path baked in at build time. Defaults to root ('/') so a fresh
// clone or a root-domain host works with zero config; the GH Pages workflow
// sets VITE_BASE_PATH=/NHQI-Tracking/ to override it for that deploy only.
const base = process.env.VITE_BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
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
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
