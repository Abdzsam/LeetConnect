import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import cors from '@fastify/cors'

async function corsPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (server-to-server, Postman, etc.)
      if (!origin) {
        cb(null, true)
        return
      }
      // Allow Chrome extension origins
      if (/^chrome-extension:\/\//.test(origin)) {
        cb(null, true)
        return
      }
      // Allow localhost for development
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
        cb(null, true)
        return
      }
      // Allow LeetCode (content script fetches originate from the page)
      if (origin === 'https://leetcode.com') {
        cb(null, true)
        return
      }
      cb(new Error('Not allowed by CORS'), false)
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    exposedHeaders: ['Authorization'],
    credentials: true,
  })
}

export default fp(corsPlugin, { name: 'cors-plugin' })
