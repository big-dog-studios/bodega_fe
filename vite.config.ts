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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
