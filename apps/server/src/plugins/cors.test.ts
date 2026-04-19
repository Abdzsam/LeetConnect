import { describe, it, expect } from 'vitest'

/**
 * The CORS origin validator is not exported from cors.ts — it's inlined in the
 * fastify.register() call. We extract the same logic here as a plain function
 * so we can unit-test it without spinning up a full Fastify instance.
 */

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  if (/^chrome-extension:\/\//.test(origin)) return true
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true
  return false
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CORS origin validator', () => {
  it('allows requests with no origin (server-to-server)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true)
  })

  it('allows chrome-extension:// origins', () => {
    expect(isAllowedOrigin('chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef')).toBe(true)
  })

  it('allows any chrome-extension:// regardless of extension ID', () => {
    expect(isAllowedOrigin('chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true)
  })

  it('allows http://localhost without a port', () => {
    expect(isAllowedOrigin('http://localhost')).toBe(true)
  })

  it('allows http://localhost:3000', () => {
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true)
  })

  it('allows http://localhost:5173 (Vite dev server)', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
  })

  it('rejects https://evil.com', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false)
  })

  it('rejects https://leetcode.com (only the socket server allows this)', () => {
    // The HTTP CORS plugin does NOT allowlist leetcode.com (only socket.io does)
    expect(isAllowedOrigin('https://leetcode.com')).toBe(false)
  })

  it('rejects http://not-localhost:3000', () => {
    expect(isAllowedOrigin('http://not-localhost:3000')).toBe(false)
  })

  it('rejects https://localhost (https is not allowed, only http)', () => {
    expect(isAllowedOrigin('https://localhost')).toBe(false)
  })

  it('treats an empty string origin the same as no origin (falsy)', () => {
    // In the actual cors plugin the callback checks `if (!origin)` — an empty
    // string is falsy, so it is treated as "no origin" and allowed.
    // The regex tests below would return false for '', but the guard fires first.
    expect(isAllowedOrigin('')).toBe(true)
  })
})
