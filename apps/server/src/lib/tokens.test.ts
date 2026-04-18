import { describe, it, expect } from 'vitest'
import { signAccessToken, verifyAccessToken, generateRefreshToken, hashToken } from './tokens.js'

// ─── signAccessToken ──────────────────────────────────────────────────────────

describe('signAccessToken', () => {
  it('returns a string with three JWT segments', async () => {
    const token = await signAccessToken('user-123')
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })

  it('encodes the sub claim as the provided userId', async () => {
    const userId = 'user-abc-456'
    const token = await signAccessToken(userId)
    // Decode payload without verification to check claims
    const payloadB64 = token.split('.')[1]
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'))
    expect(payload.sub).toBe(userId)
  })

  it('encodes type claim as "access"', async () => {
    const token = await signAccessToken('user-1')
    const payloadB64 = token.split('.')[1]
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'))
    expect(payload.type).toBe('access')
  })

  it('sets expiry approximately 15 minutes from now', async () => {
    const before = Math.floor(Date.now() / 1000)
    const token = await signAccessToken('user-1')
    const after = Math.floor(Date.now() / 1000)
    const payloadB64 = token.split('.')[1]
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as {
      exp: number
      iat: number
    }
    // exp should be iat + 900 (15 minutes in seconds)
    expect(payload.exp - payload.iat).toBe(900)
    // iat should be within the test window
    expect(payload.iat).toBeGreaterThanOrEqual(before)
    expect(payload.iat).toBeLessThanOrEqual(after)
  })

  it('uses HS256 algorithm', async () => {
    const token = await signAccessToken('user-1')
    const headerB64 = token.split('.')[0]
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'))
    expect(header.alg).toBe('HS256')
  })
})

// ─── verifyAccessToken ────────────────────────────────────────────────────────

describe('verifyAccessToken', () => {
  it('returns { sub } for a valid token issued by signAccessToken', async () => {
    const userId = 'user-verify-test'
    const token = await signAccessToken(userId)
    const result = await verifyAccessToken(token)
    expect(result.sub).toBe(userId)
  })

  it('throws for a completely invalid token string', async () => {
    await expect(verifyAccessToken('not.a.jwt')).rejects.toThrow()
  })

  it('throws for a tampered token (modified payload segment)', async () => {
    const token = await signAccessToken('user-1')
    const parts = token.split('.')
    // Flip a character in the payload to invalidate the signature
    const tamperedPayload = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'A' ? 'B' : 'A')
    const tampered = [parts[0], tamperedPayload, parts[2]].join('.')
    await expect(verifyAccessToken(tampered)).rejects.toThrow()
  })

  it('throws when the type claim is not "access"', async () => {
    // Manually build a JWT with type: 'refresh' signed with the same secret
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env['JWT_SECRET'])
    const wrongTypeToken = await new SignJWT({ sub: 'user-1', type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret)

    await expect(verifyAccessToken(wrongTypeToken)).rejects.toThrow('Invalid access token')
  })

  it('throws when the sub claim is missing', async () => {
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env['JWT_SECRET'])
    const noSubToken = await new SignJWT({ type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret)

    await expect(verifyAccessToken(noSubToken)).rejects.toThrow('Invalid access token')
  })

  it('throws for an expired token', async () => {
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env['JWT_SECRET'])
    // Issue a token that expired 1 second ago
    const expiredToken = await new SignJWT({ sub: 'user-1', type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(new Date(Date.now() - 2000))
      .setExpirationTime(new Date(Date.now() - 1000))
      .sign(secret)

    await expect(verifyAccessToken(expiredToken)).rejects.toThrow()
  })

  it('throws for a token signed with a different secret', async () => {
    const { SignJWT } = await import('jose')
    const wrongSecret = new TextEncoder().encode('wrong-secret-entirely')
    const badToken = await new SignJWT({ sub: 'user-1', type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(wrongSecret)

    await expect(verifyAccessToken(badToken)).rejects.toThrow()
  })
})

// ─── generateRefreshToken ─────────────────────────────────────────────────────

describe('generateRefreshToken', () => {
  it('returns a string of exactly 96 hex characters (48 bytes)', () => {
    const token = generateRefreshToken()
    expect(typeof token).toBe('string')
    expect(token).toHaveLength(96)
  })

  it('only contains valid hex characters', () => {
    const token = generateRefreshToken()
    expect(token).toMatch(/^[0-9a-f]{96}$/)
  })

  it('returns a different value on each call (collision resistance)', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateRefreshToken()))
    expect(tokens.size).toBe(10)
  })
})

// ─── hashToken ────────────────────────────────────────────────────────────────

describe('hashToken', () => {
  it('returns a 64-character hex string (SHA-256 output)', () => {
    const hash = hashToken('some-token-value')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same input always produces same hash', () => {
    const token = 'consistent-token'
    expect(hashToken(token)).toBe(hashToken(token))
  })

  it('different inputs produce different hashes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'))
  })

  it('matches a known SHA-256 value for a fixed input', () => {
    // SHA-256 of "hello" = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    expect(hashToken('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
  })

  it('full refresh token round-trip — hash of generated token is consistent', () => {
    const token = generateRefreshToken()
    const hash1 = hashToken(token)
    const hash2 = hashToken(token)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
  })
})
