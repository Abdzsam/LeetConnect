// The chrome global is stubbed in src/test-setup.ts before module evaluation.
import { describe, it, expect } from 'vitest'
import { isInternalMessage } from './service-worker.js'

// ─── isInternalMessage type guard ─────────────────────────────────────────────

describe('isInternalMessage', () => {
  const validTypes = [
    'PING',
    'GET_AUTH_STATUS',
    'SET_TOKENS',
    'CLEAR_AUTH',
    'INITIATE_GOOGLE_AUTH',
    'REFRESH_TOKEN',
    'GET_USER',
    'LOGOUT',
  ] as const

  it.each(validTypes)('accepts { type: "%s" } as a valid internal message', (type) => {
    const msg =
      type === 'SET_TOKENS'
        ? { type, accessToken: 'a.b.c', refreshToken: 'refresh' }
        : { type }
    expect(isInternalMessage(msg)).toBe(true)
  })

  it('rejects a message with an unknown type', () => {
    expect(isInternalMessage({ type: 'UNKNOWN_TYPE' })).toBe(false)
  })

  it('rejects a message with no type field', () => {
    expect(isInternalMessage({ action: 'PING' })).toBe(false)
  })

  it('rejects null', () => {
    expect(isInternalMessage(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(isInternalMessage(undefined)).toBe(false)
  })

  it('rejects a plain string', () => {
    expect(isInternalMessage('PING')).toBe(false)
  })

  it('rejects a number', () => {
    expect(isInternalMessage(42)).toBe(false)
  })

  it('rejects an empty object', () => {
    expect(isInternalMessage({})).toBe(false)
  })

  it('rejects an object with a numeric type', () => {
    expect(isInternalMessage({ type: 42 })).toBe(false)
  })

  it('rejects an array', () => {
    expect(isInternalMessage(['PING'])).toBe(false)
  })

  it('rejects a message with type matching a known prefix but not the full string', () => {
    expect(isInternalMessage({ type: 'GET_AUTH' })).toBe(false)
  })
})
