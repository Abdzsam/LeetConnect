import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { verifyAccessToken } from '../lib/tokens.js'

// ─── Module augmentation ───────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string } | null
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

async function authPlugin(fastify: FastifyInstance): Promise<void> {
  // Decorate all requests with null user by default
  fastify.decorateRequest('user', null)

  // Expose the authenticate preHandler as a named decorator
  fastify.decorate(
    'authenticate',
    async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const authHeader = request.headers['authorization']
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({ ok: false, error: 'Missing or invalid Authorization header' })
        return
      }

      const token = authHeader.slice(7)
      try {
        const payload = await verifyAccessToken(token)
        request.user = { id: payload.sub }
      } catch {
        reply.code(401).send({ ok: false, error: 'Invalid or expired access token' })
      }
    },
  )
}

export default fp(authPlugin, { name: 'auth-plugin' })

// ─── Type augmentation for the decorator ─────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
