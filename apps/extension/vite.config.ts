import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const serverUrl = env['VITE_SERVER_URL'] ?? 'http://localhost:3000'

  return {
    plugins: [
      react(),
      crx({ manifest }),
    ],
    define: {
      __SERVER_URL__: JSON.stringify(serverUrl),
    },
    build: {
      sourcemap: mode !== 'production',
      assetsInlineLimit: 0,
    },
    assetsInclude: [],
  }
})
