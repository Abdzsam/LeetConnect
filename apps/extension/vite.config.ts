import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    sourcemap: true,
    // Ensure inline assets work for shadow DOM style injection
    assetsInlineLimit: 0,
  },
  // Allow ?inline imports for CSS (used by shadow DOM style injection)
  assetsInclude: [],
})
