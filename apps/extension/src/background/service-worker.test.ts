// The chrome global is stubbed in src/test-setup.ts before module evaluation.
// service-worker.ts calls chrome.runtime.onMessage.addListener() at module scope;
// by the time this file's top-level imports resolve, the handler is registered.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isInternalMessage } from './service-worker.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Build a valid-looking JWT with a given `sub` claim.
function makeJwt(sub: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payload = btoa(JSON.stringify({ sub, type: 'access', iat: 1 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${header}.${payload}.sig`
}

const VALID_JWT = makeJwt('user-abc')
const VALID_REFRESH = 'a'.repeat(32) // >= 16 chars

// ─── Grab the onMessage handler that service-worker.ts registered ─────────────
// test-setup.ts installed chrome.runtime.onMessage.addListener as a vi.fn().
// When service-worker.ts was imported above, it called addListener with its
// actual message handler. We retrieve that handler from the mock's call history.

type MessageHandler = (
  message: unknown,
  sender: object,
  sendResponse: (r: unknown) => void,
) => boolean

type ChromeMock = {
  runtime: {
    id: string
    onMessage: { addListener: ReturnType<typeof vi.fn> }
  }
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>
      set: ReturnType<typeof vi.fn>
      remove: ReturnType<typeof vi.fn>
    }
  }
}

const chromeMock = (globalThis as unknown as { chrome: ChromeMock }).chrome
const storageLocal = chromeMock.storage.local

// Retrieve the handler that service-worker.ts registered on import
const onMessageCalls = chromeMock.runtime.onMessage.addListener.mock.calls as Array<[MessageHandler]>
const messageHandler: MessageHandler = onMessageCalls[0]![0]

// A valid internal sender (same extension, chrome-extension:// URL)
const internalSender = {
  id: 'test-extension-id',
  url: 'chrome-extension://test-extension-id/popup.html',
}

/** Dispatch a message through the real handler and return the response. */
function dispatchMessage(
  message: unknown,
  sender: object = internalSender,
): Promise<unknown> {
  return new Promise((resolve) => {
    messageHandler(message, sender, resolve)
  })
}

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

// ─── Message handler: security checks ────────────────────────────────────────

describe('onMessage — sender security checks', () => {
  beforeEach(() => {
    storageLocal.get.mockReset()
    storageLocal.set.mockReset()
    storageLocal.remove.mockReset()
  })

  it('rejects a sender with a different extension id', async () => {
    const res = await dispatchMessage(
      { type: 'PING' },
      { id: 'evil-extension-id', url: 'chrome-extension://evil/popup.html' },
    )
    expect((res as { ok: boolean }).ok).toBe(false)
  })

  it('rejects a sender whose url is non-chrome-extension and has no tab', async () => {
    const res = await dispatchMessage({ type: 'PING' }, {
      id: 'test-extension-id',
      url: 'https://evil.com/inject.js',
    })
    expect((res as { ok: boolean }).ok).toBe(false)
  })

  it('allows a content-script sender (has .tab set)', async () => {
    // The PING handler is synchronous — no storage needed
    const res = await dispatchMessage({ type: 'PING' }, {
      id: 'test-extension-id',
      url: 'https://leetcode.com/problems/two-sum',
      tab: { id: 42 },
    })
    expect((res as { ok: boolean }).ok).toBe(true)
  })

  it('rejects an unknown message type', async () => {
    const res = await dispatchMessage({ type: 'BOGUS' })
    expect((res as { ok: boolean }).ok).toBe(false)
  })
})

// ─── PING ─────────────────────────────────────────────────────────────────────

describe('PING handler', () => {
  it('returns { ok: true, data: { pong: true } }', async () => {
    const res = await dispatchMessage({ type: 'PING' }) as { ok: boolean; data: { pong: boolean } }
    expect(res.ok).toBe(true)
    expect(res.data.pong).toBe(true)
  })
})

// ─── GET_AUTH_STATUS ──────────────────────────────────────────────────────────

describe('GET_AUTH_STATUS handler', () => {
  beforeEach(() => {
    storageLocal.get.mockReset()
  })

  it('returns authenticated: true when an accessToken is stored', async () => {
    storageLocal.get.mockResolvedValue({ accessToken: VALID_JWT, userId: 'user-abc' })
    const res = await dispatchMessage({ type: 'GET_AUTH_STATUS' }) as {
      ok: boolean
      data: { authenticated: boolean; userId: string }
    }
    expect(res.ok).toBe(true)
    expect(res.data.authenticated).toBe(true)
    expect(res.data.userId).toBe('user-abc')
  })

  it('returns authenticated: false when accessToken is null', async () => {
    storageLocal.get.mockResolvedValue({ accessToken: null, userId: null })
    const res = await dispatchMessage({ type: 'GET_AUTH_STATUS' }) as {
      ok: boolean
      data: { authenticated: boolean }
    }
    expect(res.ok).toBe(true)
    expect(res.data.authenticated).toBe(false)
  })

  it('returns authenticated: false when storage returns no accessToken key', async () => {
    storageLocal.get.mockResolvedValue({})
    const res = await dispatchMessage({ type: 'GET_AUTH_STATUS' }) as {
      ok: boolean
      data: { authenticated: boolean }
    }
    expect(res.ok).toBe(true)
    expect(res.data.authenticated).toBe(false)
  })

  it('returns ok: false on storage error', async () => {
    storageLocal.get.mockRejectedValue(new Error('storage failure'))
    const res = await dispatchMessage({ type: 'GET_AUTH_STATUS' }) as { ok: boolean }
    expect(res.ok).toBe(false)
  })
})

// ─── SET_TOKENS ───────────────────────────────────────────────────────────────

describe('SET_TOKENS handler', () => {
  beforeEach(() => {
    storageLocal.set.mockReset()
  })

  it('stores tokens and returns userId extracted from JWT payload', async () => {
    storageLocal.set.mockResolvedValue(undefined)
    const res = await dispatchMessage({
      type: 'SET_TOKENS',
      accessToken: VALID_JWT,
      refreshToken: VALID_REFRESH,
    }) as { ok: boolean; data: { userId: string } }
    expect(res.ok).toBe(true)
    expect(res.data.userId).toBe('user-abc')
    expect(storageLocal.set).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: VALID_JWT, refreshToken: VALID_REFRESH }),
    )
  })

  it('rejects an accessToken that does not match JWT_PATTERN', async () => {
    const res = await dispatchMessage({
      type: 'SET_TOKENS',
      accessToken: 'not-a-jwt',
      refreshToken: VALID_REFRESH,
    }) as { ok: boolean; error: string }
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/invalid access token format/i)
  })

  it('rejects a refreshToken that is too short (< 16 chars)', async () => {
    const res = await dispatchMessage({
      type: 'SET_TOKENS',
      accessToken: VALID_JWT,
      refreshToken: 'short',
    }) as { ok: boolean; error: string }
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/invalid refresh token format/i)
  })

  it('returns ok: false on storage error', async () => {
    storageLocal.set.mockRejectedValue(new Error('disk full'))
    const res = await dispatchMessage({
      type: 'SET_TOKENS',
      accessToken: VALID_JWT,
      refreshToken: VALID_REFRESH,
    }) as { ok: boolean }
    expect(res.ok).toBe(false)
  })
})

// ─── CLEAR_AUTH ───────────────────────────────────────────────────────────────

describe('CLEAR_AUTH handler', () => {
  beforeEach(() => {
    storageLocal.remove.mockReset()
  })

  it('removes accessToken, refreshToken, and userId', async () => {
    storageLocal.remove.mockResolvedValue(undefined)
    const res = await dispatchMessage({ type: 'CLEAR_AUTH' }) as { ok: boolean }
    expect(res.ok).toBe(true)
    expect(storageLocal.remove).toHaveBeenCalledWith(
      expect.arrayContaining(['accessToken', 'refreshToken', 'userId']),
    )
  })

  it('returns ok: false on storage error', async () => {
    storageLocal.remove.mockRejectedValue(new Error('storage error'))
    const res = await dispatchMessage({ type: 'CLEAR_AUTH' }) as { ok: boolean }
    expect(res.ok).toBe(false)
  })
})

// ─── REFRESH_TOKEN ────────────────────────────────────────────────────────────

describe('REFRESH_TOKEN handler', () => {
  beforeEach(() => {
    storageLocal.get.mockReset()
    storageLocal.set.mockReset()
    vi.restoreAllMocks()
  })

  it('returns ok: false when no refresh token is stored', async () => {
    storageLocal.get.mockResolvedValue({ refreshToken: null })
    const res = await dispatchMessage({ type: 'REFRESH_TOKEN' }) as { ok: boolean; error: string }
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/no refresh token/i)
  })

  it('fetches a new token pair and stores it', async () => {
    const newJwt = makeJwt('user-abc')
    storageLocal.get.mockResolvedValue({ refreshToken: VALID_REFRESH })
    storageLocal.set.mockResolvedValue(undefined)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: newJwt,
          refresh_token: 'newrefreshtoken12345',
          expires_in: 900,
        }),
      }),
    )

    const res = await dispatchMessage({ type: 'REFRESH_TOKEN' }) as {
      ok: boolean
      data: { accessToken: string; expiresIn: number }
    }
    expect(res.ok).toBe(true)
    expect(res.data.accessToken).toBe(newJwt)
    expect(storageLocal.set).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: newJwt }),
    )
  })

  it('returns ok: false when the server returns an error', async () => {
    storageLocal.get.mockResolvedValue({ refreshToken: VALID_REFRESH })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'token expired' }),
      }),
    )

    const res = await dispatchMessage({ type: 'REFRESH_TOKEN' }) as { ok: boolean }
    expect(res.ok).toBe(false)
  })

  it('returns ok: false when the new access_token is malformed', async () => {
    storageLocal.get.mockResolvedValue({ refreshToken: VALID_REFRESH })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'not-a-jwt',
          refresh_token: 'new-refresh-123456789',
          expires_in: 900,
        }),
      }),
    )

    const res = await dispatchMessage({ type: 'REFRESH_TOKEN' }) as { ok: boolean }
    expect(res.ok).toBe(false)
  })
})

// ─── GET_USER ─────────────────────────────────────────────────────────────────

describe('GET_USER handler', () => {
  beforeEach(() => {
    storageLocal.get.mockReset()
    storageLocal.set.mockReset()
    vi.restoreAllMocks()
  })

  it('returns ok: false when not authenticated', async () => {
    storageLocal.get.mockResolvedValue({ accessToken: null })
    const res = await dispatchMessage({ type: 'GET_USER' }) as { ok: boolean; error: string }
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not authenticated/i)
  })

  it('returns the user data from the API on success', async () => {
    const userData = { id: 'user-abc', name: 'Alice', email: 'alice@example.com' }
    storageLocal.get.mockResolvedValue({ accessToken: VALID_JWT })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => userData,
      }),
    )

    const res = await dispatchMessage({ type: 'GET_USER' }) as { ok: boolean; data: typeof userData }
    expect(res.ok).toBe(true)
    expect(res.data).toEqual(userData)
  })

  it('returns ok: false when the API call fails', async () => {
    storageLocal.get.mockResolvedValue({ accessToken: VALID_JWT })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'server error' }),
      }),
    )

    const res = await dispatchMessage({ type: 'GET_USER' }) as { ok: boolean }
    expect(res.ok).toBe(false)
  })
})

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

describe('LOGOUT handler', () => {
  beforeEach(() => {
    storageLocal.get.mockReset()
    storageLocal.remove.mockReset()
    vi.restoreAllMocks()
  })

  it('removes tokens from storage after successful logout call', async () => {
    storageLocal.get.mockResolvedValue({ accessToken: VALID_JWT, refreshToken: VALID_REFRESH })
    storageLocal.remove.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))

    const res = await dispatchMessage({ type: 'LOGOUT' }) as { ok: boolean }
    expect(res.ok).toBe(true)
    expect(storageLocal.remove).toHaveBeenCalledWith(
      expect.arrayContaining(['accessToken', 'refreshToken', 'userId']),
    )
  })

  it('clears storage even when the fetch call fails (network unreachable)', async () => {
    storageLocal.get.mockResolvedValue({ accessToken: VALID_JWT, refreshToken: VALID_REFRESH })
    storageLocal.remove.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const res = await dispatchMessage({ type: 'LOGOUT' }) as { ok: boolean }
    expect(res.ok).toBe(true)
    expect(storageLocal.remove).toHaveBeenCalled()
  })

  it('succeeds without making a fetch call when no accessToken is stored', async () => {
    storageLocal.get.mockResolvedValue({ accessToken: null, refreshToken: null })
    storageLocal.remove.mockResolvedValue(undefined)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await dispatchMessage({ type: 'LOGOUT' }) as { ok: boolean }
    expect(res.ok).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
