import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Keep React's hook dispatcher shared by the app, react-dom, and Zustand
    // even when Vite is started from a parent workspace or after HMR cache
    // invalidation.
    dedupe: ['react', 'react-dom'],
  },
})
