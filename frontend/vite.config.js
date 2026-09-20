import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app shell only -- workbox's default generateSW precaches
    // just the build output (JS/CSS/HTML/icons), never API responses. No
    // runtimeCaching rules are added for /api on purpose: this app's whole
    // value is live pressure/booking/gig data, so serving a cached response
    // for that would be actively dishonest, not just stale. Offline means
    // "the shell loads instantly, then asks the network like normal" --
    // never "here's yesterday's crowding number."
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true }, // installable/testable from `npm run dev`, not just a production build
      manifest: {
        name: 'Sahyatri',
        short_name: 'Sahyatri',
        description: 'Tourism, redistributed -- we check crowding before you book, not after.',
        theme_color: '#10192b',
        background_color: '#ecede6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    // Keep React's hook dispatcher shared by the app, react-dom, and Zustand
    // even when Vite is started from a parent workspace or after HMR cache
    // invalidation.
    dedupe: ['react', 'react-dom'],
  },
})
