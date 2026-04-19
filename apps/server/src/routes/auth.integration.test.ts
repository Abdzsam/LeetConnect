/**
 * Integration tests for auth routes using fastify.inject().
 * No real network or DB calls — db and google-oauth are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks (must be declared before any imports that resolve those modules) ───
// vi.mock is hoisted to the top of the file, so we use vi.hoisted() to
// initialise the mock object before the factory closure runs.

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../db/index.js', () => ({ db: mockDb }))

// Mock google-oauth (the `google` singleton used in non-exchange routes)
vi.mock('../lib/google-oauth.js', () => ({
  google: {
    createAuthorizationURL: vi.fn(() => new URL('https://accounts.google.com/o/oauth2/auth?mock=1')),
    validateAuthorizationCode: vi.fn(),
  },
}))

// ─── Actual imports (after mocks) ─────────────────────────────────────────────

import Fastify from 'fastify'
import authPlugin from '../plugins/auth.js'
import authRoutes from './auth.js'
import { signAccessToken, generateRefreshToken, hashToken } from '../lib/tokens.js'

// ─── Test app factory ─────────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(authPlugin)
  await app.register(authRoutes, { prefix: '/' })
  await app.ready()
  return app
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chainableSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
  }
  return chain
}

function chainableInsert(returnRows: unknown[]) {
  const chain = {
    values: vi.fn(() => chain),
    onConflictDoUpdate: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(returnRows)),
    // For inserts without .returning()
    then: (resolve: (v: unknown) => void) => resolve(returnRows),
  }
  return chain
}

function chainableDelete() {
  const chain = {
    where: vi.fn(() => Promise.resolve([])),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── GET /auth/google/init ────────────────────────────────────────────────────

describe('GET /auth/google/init', () => {
  it('returns 200 with an authUrl for a valid ext_redirect_uri', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/auth/google/init?ext_redirect_uri=https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; authUrl: string }
    expect(body.ok).toBe(true)
    expect(typeof body.authUrl).toBe('string')
    expect(body.authUrl).toContain('accounts.google.com')
  })

  it('returns 400 for a missing ext_redirect_uri', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/google/init' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for an invalid ext_redirect_uri (non-chromiumapp.org)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/auth/google/init?ext_redirect_uri=https://evil.com/',
    })
    expect(res.statusCode).toBe(400)
  })
})

// ─── POST /auth/google/exchange ───────────────────────────────────────────────

describe('POST /auth/google/exchange', () => {
  it('returns 400 when code or state is missing', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google/exchange',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when the state is invalid or expired', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google/exchange',
      payload: { code: 'some-code', state: 'nonexistent-state' },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('returns 400 when refresh_token is missing', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 when the refresh token is not found in DB', async () => {
    // db.select returns an empty array (token not found)
    mockDb.select.mockReturnValue(chainableSelect([]))

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: 'unknown-token-that-has-no-hash-match' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 when the refresh token is expired', async () => {
    const expired = new Date(Date.now() - 1000)
    mockDb.select.mockReturnValue(
      chainableSelect([{ id: 'rt-1', userId: 'u1', tokenHash: 'hash', expiresAt: expired }]),
    )
    mockDb.delete.mockReturnValue(chainableDelete())

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: generateRefreshToken() },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with new tokens for a valid refresh token', async () => {
    const userId = 'user-uuid-123'
    const refreshToken = generateRefreshToken()
    const tokenHash = hashToken(refreshToken)
    const futureExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    mockDb.select.mockReturnValue(
      chainableSelect([{ id: 'rt-1', userId, tokenHash, expiresAt: futureExpiry }]),
    )
    mockDb.delete.mockReturnValue(chainableDelete())
    mockDb.insert.mockReturnValue(chainableInsert([{ id: 'rt-2' }]))

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: refreshToken },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; access_token: string; refresh_token: string }
    expect(body.ok).toBe(true)
    expect(typeof body.access_token).toBe('string')
    expect(typeof body.refresh_token).toBe('string')
  })
})

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

describe('GET /auth/me', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for an invalid bearer token', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: 'Bearer not-a-real-token' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with user data for a valid bearer token', async () => {
    const userId = 'user-uuid-456'
    const token = await signAccessToken(userId)
    const dbUser = {
      id: userId,
      email: 'alice@example.com',
      name: 'Alice',
      avatarUrl: null,
      createdAt: new Date(),
    }

    mockDb.select.mockReturnValue(chainableSelect([dbUser]))

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; id: string; email: string }
    expect(body.ok).toBe(true)
    expect(body.id).toBe(userId)
    expect(body.email).toBe('alice@example.com')
  })

  it('returns 404 when the user is not found in DB', async () => {
    const userId = 'nonexistent-user'
    const token = await signAccessToken(userId)
    mockDb.select.mockReturnValue(chainableSelect([]))

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ─── POST /auth/logout ────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('returns 401 when not authenticated', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/logout' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 204 for an authenticated user with a refresh token', async () => {
    const userId = 'user-uuid-789'
    const token = await signAccessToken(userId)
    const refreshToken = generateRefreshToken()
    mockDb.delete.mockReturnValue(chainableDelete())

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { Authorization: `Bearer ${token}` },
      payload: { refresh_token: refreshToken },
    })
    expect(res.statusCode).toBe(204)
    expect(mockDb.delete).toHaveBeenCalledOnce()
  })

  it('returns 204 for an authenticated user without a refresh token (deletes all tokens)', async () => {
    const userId = 'user-uuid-789'
    const token = await signAccessToken(userId)
    mockDb.delete.mockReturnValue(chainableDelete())

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { Authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(204)
    expect(mockDb.delete).toHaveBeenCalledOnce()
  })
})
