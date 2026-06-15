/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
// NOTE: @vitejs/plugin-legacy was removed — MapLibre GL requires modern browsers
// (BigInt/WebGL2) and can't be down-compiled to legacy targets. Capacitor runs in
// modern WebViews, so legacy bundles aren't needed.
export default defineConfig({
  plugins: [
    react(),
  ],
  // Dev-only: proxy /api -> the API gateway so the browser makes a same-origin
  // request (the API doesn't send CORS headers). Set VITE_API_BASE_URL=/api in dev.
  server: {
    proxy: {
      '/api': {
        target: 'https://bodega-gateway-2q60deae.ue.gateway.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
