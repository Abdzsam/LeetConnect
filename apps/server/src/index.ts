import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) (globalThis as any).crypto = webcrypto

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { config } from './config.js'
import corsPlugin from './plugins/cors.js'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import { createSocketServer } from './socket/index.js'

const app = Fastify({
  logger: { level: config.nodeEnv === 'production' ? 'warn' : 'info' },
  trustProxy: true,
})

await app.register(corsPlugin)
await app.register(cookie)
await app.register(authPlugin)
await app.register(authRoutes, { prefix: '/' })

app.get('/health', async () => ({ status: 'ok', ts: Date.now() }))

await app.listen({ port: config.port, host: '0.0.0.0' })
createSocketServer(app.server)
