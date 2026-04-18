import { describe, it, expect, vi } from 'vitest'

// Mock heavy modules that make real network calls at import time
vi.mock('../db/index.js', () => ({ db: {} }))
vi.mock('../lib/google-oauth.js', () => ({ google: {} }))

import { isValidExtensionRedirectUri, buildTokenRedirect } from './auth.js'

// ─── isValidExtensionRedirectUri ──────────────────────────────────────────────

describe('isValidExtensionRedirectUri', () => {
  // Valid chromiumapp.org URLs
  it('accepts a valid https chromiumapp.org URL with 32-char lowercase id', () => {
    expect(isValidExtensionRedirectUri('https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/')).toBe(true)
  })

  it('accepts chromiumapp.org URL without trailing slash', () => {
    expect(isValidExtensionRedirectUri('https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org')).toBe(true)
  })

  it('accepts chromiumapp.org URL with a path', () => {
    expect(isValidExtensionRedirectUri('https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/callback')).toBe(true)
  })

  // Valid chrome-extension:// URLs
  it('accepts a valid chrome-extension:// URL with 32-char lowercase id', () => {
    expect(isValidExtensionRedirectUri('chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/')).toBe(true)
  })

  it('accepts chrome-extension:// URL without trailing slash', () => {
    expect(isValidExtensionRedirectUri('chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef')).toBe(true)
  })

  // Rejection cases
  it('rejects an arbitrary HTTPS URL (evil.com)', () => {
    expect(isValidExtensionRedirectUri('https://evil.com')).toBe(false)
  })

  it('rejects javascript: URI', () => {
    expect(isValidExtensionRedirectUri('javascript:alert(1)')).toBe(false)
  })

  it('rejects http (non-https) chromiumapp.org URL', () => {
    expect(isValidExtensionRedirectUri('http://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/')).toBe(false)
  })

  it('rejects chromiumapp.org with fewer than 32 chars in the subdomain', () => {
    expect(isValidExtensionRedirectUri('https://short.chromiumapp.org/')).toBe(false)
  })

  it('rejects chromiumapp.org subdomain containing uppercase letters', () => {
    expect(isValidExtensionRedirectUri('https://ABCDEFGHIJKLMNOPQRSTUVWXYZ123456.chromiumapp.org/')).toBe(false)
  })

  it('rejects chromiumapp.org subdomain containing numbers', () => {
    // 32 chars but contains digits, which the regex [a-z]{32} disallows
    expect(isValidExtensionRedirectUri('https://abcdefghijklmnopqrstuvwx1234.chromiumapp.org/')).toBe(false)
  })

  it('rejects chrome-extension:// with uppercase id', () => {
    expect(isValidExtensionRedirectUri('chrome-extension://ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF/')).toBe(false)
  })

  it('rejects chrome-extension:// with fewer than 32 chars', () => {
    expect(isValidExtensionRedirectUri('chrome-extension://tooshort/')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidExtensionRedirectUri('')).toBe(false)
  })

  it('rejects a non-URL string', () => {
    expect(isValidExtensionRedirectUri('not-a-url-at-all')).toBe(false)
  })

  it('rejects a data: URI', () => {
    expect(isValidExtensionRedirectUri('data:text/html,<script>alert(1)</script>')).toBe(false)
  })
})

// ─── buildTokenRedirect ───────────────────────────────────────────────────────

describe('buildTokenRedirect', () => {
  const BASE_URI = 'https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/'

  it('appends access_token query param', () => {
    const url = buildTokenRedirect(BASE_URI, 'access-tok', 'refresh-tok')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('access_token')).toBe('access-tok')
  })

  it('appends refresh_token query param', () => {
    const url = buildTokenRedirect(BASE_URI, 'access-tok', 'refresh-tok')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('refresh_token')).toBe('refresh-tok')
  })

  it('appends expires_in as "900"', () => {
    const url = buildTokenRedirect(BASE_URI, 'access-tok', 'refresh-tok')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('expires_in')).toBe('900')
  })

  it('preserves the base URI origin and pathname', () => {
    const url = buildTokenRedirect(BASE_URI, 'at', 'rt')
    const parsed = new URL(url)
    expect(parsed.hostname).toBe('abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org')
    expect(parsed.protocol).toBe('https:')
  })

  it('works with chrome-extension:// base URI', () => {
    const chromeUri = 'chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/'
    const url = buildTokenRedirect(chromeUri, 'at', 'rt')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('access_token')).toBe('at')
    expect(parsed.searchParams.get('refresh_token')).toBe('rt')
  })
})
