import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  // Allow the dev server to read from the repo root so we can import
  // ../../../shared/issues.json (the canonical issue list lives outside
  // client/ so it can be shared with server.js and the Python pipeline).
  server: {
    fs: {
      allow: [".."],
    },
  },
  plugins: [
    react(),
    VitePWA({
      // Basic PWA configuration - you can expand this later
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true // Enable PWA in development
      },
      manifest: {
        name: 'Of the People',
        short_name: 'OtP',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: '/vite.svg', // Use the existing Vite logo that's already in your public folder
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
})
