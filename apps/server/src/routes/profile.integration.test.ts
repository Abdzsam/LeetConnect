/**
 * Integration tests for profile routes using fastify.inject().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock is hoisted before variable declarations, so use vi.hoisted().

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../db/index.js', () => ({ db: mockDb }))
vi.mock('../lib/google-oauth.js', () => ({ google: {} }))

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import Fastify from 'fastify'
import authPlugin from '../plugins/auth.js'
import profileRoutes from './profile.js'
import { signAccessToken } from '../lib/tokens.js'

// ─── Test app factory ─────────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(authPlugin)
  await app.register(profileRoutes, { prefix: '/' })
  await app.ready()
  return app
}

// ─── Query chain helpers ──────────────────────────────────────────────────────

function chainableSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    // Some selects don't call limit()
    then(resolve: (v: unknown[]) => void) { return Promise.resolve(rows).then(resolve) },
  }
  return chain
}

function chainableInsert(returnRows: unknown[]) {
  const chain = {
    values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(returnRows)),
    then(resolve: (v: unknown) => void) { return Promise.resolve(undefined).then(resolve) },
  }
  return chain
}

function chainableDelete() {
  return { where: vi.fn(() => Promise.resolve()) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── GET /profile/socials ─────────────────────────────────────────────────────

describe('GET /profile/socials', () => {
  it('returns 401 when not authenticated', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/socials' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with the user links when authenticated', async () => {
    const userId = 'user-1'
    const token = await signAccessToken(userId)
    const links = [{ platform: 'github', value: 'alice' }]

    // select().from().where() returns links
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => Promise.resolve(links)),
      limit: vi.fn(() => Promise.resolve(links)),
    }
    mockDb.select.mockReturnValue(chain)

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/profile/socials',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; links: unknown[] }
    expect(body.ok).toBe(true)
    expect(body.links).toEqual(links)
  })
})

// ─── PUT /profile/socials ─────────────────────────────────────────────────────

describe('PUT /profile/socials', () => {
  it('returns 401 when not authenticated', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/profile/socials',
      payload: { links: [] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 when links is not an array', async () => {
    const userId = 'user-1'
    const token = await signAccessToken(userId)
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/profile/socials',
      headers: { Authorization: `Bearer ${token}` },
      payload: { links: 'not-an-array' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 200 with saved links for valid input', async () => {
    const userId = 'user-1'
    const token = await signAccessToken(userId)
    const links = [{ platform: 'github', value: 'alice' }]

    mockDb.delete.mockReturnValue(chainableDelete())
    mockDb.insert.mockReturnValue(chainableInsert([]))

    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/profile/socials',
      headers: { Authorization: `Bearer ${token}` },
      payload: { links },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; links: unknown[] }
    expect(body.ok).toBe(true)
    // The saved links should contain github entry
    expect(
      (body.links as Array<{ platform: string }>).some((l) => l.platform === 'github'),
    ).toBe(true)
  })

  it('silently filters out invalid platform names', async () => {
    const userId = 'user-1'
    const token = await signAccessToken(userId)

    mockDb.delete.mockReturnValue(chainableDelete())
    // No insert call needed since no valid links

    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/profile/socials',
      headers: { Authorization: `Bearer ${token}` },
      payload: { links: [{ platform: 'fakebook', value: 'alice' }] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; links: unknown[] }
    expect(body.ok).toBe(true)
    expect(body.links).toHaveLength(0) // invalid platform filtered out
  })

  it('silently filters out values that are too long', async () => {
    const userId = 'user-1'
    const token = await signAccessToken(userId)

    mockDb.delete.mockReturnValue(chainableDelete())

    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/profile/socials',
      headers: { Authorization: `Bearer ${token}` },
      payload: { links: [{ platform: 'github', value: 'a'.repeat(201) }] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; links: unknown[] }
    expect(body.links).toHaveLength(0) // too long, filtered
  })
})

// ─── GET /users/:userId/socials ───────────────────────────────────────────────

describe('GET /users/:userId/socials', () => {
  const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

  it('returns 400 for an invalid UUID', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/users/not-a-uuid/socials' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when the user is not found', async () => {
    mockDb.select.mockReturnValue(chainableSelect([]))

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `/users/${VALID_UUID}/socials` })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 with public profile for a known user', async () => {
    const user = { id: VALID_UUID, name: 'Alice', avatarUrl: null }
    const links = [{ platform: 'github', value: 'alice' }]

    // First select: user lookup (uses .limit())
    // Second select: links (uses .where() directly → awaitable)
    let callCount = 0
    mockDb.select.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // User lookup chain
        const chain = {
          from: vi.fn(() => chain),
          where: vi.fn(() => chain),
          limit: vi.fn(() => Promise.resolve([user])),
        }
        return chain
      }
      // Links lookup chain
      const chain = {
        from: vi.fn(() => chain),
        where: vi.fn(() => Promise.resolve(links)),
        limit: vi.fn(() => Promise.resolve(links)),
      }
      return chain
    })

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `/users/${VALID_UUID}/socials` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; name: string; links: unknown[] }
    expect(body.ok).toBe(true)
    expect(body.name).toBe('Alice')
    expect(body.links).toEqual(links)
  })
})
