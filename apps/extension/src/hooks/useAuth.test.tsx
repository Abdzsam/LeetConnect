// The chrome global is stubbed in src/test-setup.ts.
// Here we just grab the mock fn reference to control it per-test.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth, type AuthUser } from './useAuth.js'

// ─── Mock chrome.runtime.sendMessage ─────────────────────────────────────────

const mockSendMessage = vi.fn()
// Point the global stub at our per-test mock
;(globalThis as unknown as { chrome: { runtime: { sendMessage: typeof mockSendMessage } } })
  .chrome.runtime.sendMessage = mockSendMessage

const mockUser: AuthUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: null,
  createdAt: '2024-01-01T00:00:00.000Z',
}

beforeEach(() => {
  mockSendMessage.mockReset()
})

// ─── Initial state ────────────────────────────────────────────────────────────

describe('useAuth — initial state', () => {
  it('starts with status "loading" before any message resolves', () => {
    // Never resolves — keep it pending
    mockSendMessage.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useAuth())
    expect(result.current.state.status).toBe('loading')
  })
})

// ─── Unauthenticated flow ─────────────────────────────────────────────────────

describe('useAuth — unauthenticated transitions', () => {
  it('transitions to "unauthenticated" when GET_AUTH_STATUS returns authenticated: false', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: false } })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('unauthenticated'))
  })

  it('transitions to "unauthenticated" when GET_AUTH_STATUS returns ok: false', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: false, error: 'Storage error' })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('unauthenticated'))
  })

  it('transitions to "unauthenticated" when GET_USER fails after auth status says authenticated', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: false, error: 'Not authenticated' })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('unauthenticated'))
  })
})

// ─── Authenticated flow ───────────────────────────────────────────────────────

describe('useAuth — authenticated transitions', () => {
  it('transitions to "authenticated" with user data when both GET_AUTH_STATUS and GET_USER succeed', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockUser })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'))

    expect(result.current.state).toEqual({ status: 'authenticated', user: mockUser })
  })

  it('exposes the correct user object in the authenticated state', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockUser })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'))

    if (result.current.state.status === 'authenticated') {
      expect(result.current.state.user.id).toBe('user-123')
      expect(result.current.state.user.email).toBe('test@example.com')
    }
  })
})

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('useAuth — signIn', () => {
  it('sets status to "loading" immediately when signIn is called', async () => {
    // Start authenticated
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockUser })
      }
      if (msg.type === 'INITIATE_GOOGLE_AUTH') {
        // Never resolves — lets us observe the intermediate loading state
        return new Promise(() => {})
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'))

    act(() => { void result.current.signIn() })

    expect(result.current.state.status).toBe('loading')
  })

  it('calls INITIATE_GOOGLE_AUTH message type', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockUser })
      }
      if (msg.type === 'INITIATE_GOOGLE_AUTH') {
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'))

    await act(async () => { await result.current.signIn() })

    const initiateCall = mockSendMessage.mock.calls.find(
      ([msg]: [{ type: string }]) => msg.type === 'INITIATE_GOOGLE_AUTH',
    )
    expect(initiateCall).toBeDefined()
  })

  it('re-checks auth after INITIATE_GOOGLE_AUTH succeeds', async () => {
    let callCount = 0
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        callCount++
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockUser })
      }
      if (msg.type === 'INITIATE_GOOGLE_AUTH') {
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'))

    const countBeforeSignIn = callCount

    await act(async () => { await result.current.signIn() })

    // GET_AUTH_STATUS should have been called again after signIn
    expect(callCount).toBeGreaterThan(countBeforeSignIn)
  })

  it('transitions to "unauthenticated" when INITIATE_GOOGLE_AUTH fails', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: false, error: 'err' })
      }
      if (msg.type === 'INITIATE_GOOGLE_AUTH') {
        return Promise.resolve({ ok: false, error: 'Auth cancelled' })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('unauthenticated'))

    await act(async () => { await result.current.signIn() })

    expect(result.current.state.status).toBe('unauthenticated')
  })
})

// ─── signOut ──────────────────────────────────────────────────────────────────

describe('useAuth — signOut', () => {
  it('calls the LOGOUT message type', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockUser })
      }
      if (msg.type === 'LOGOUT') {
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'))

    await act(async () => { await result.current.signOut() })

    const logoutCall = mockSendMessage.mock.calls.find(
      ([msg]: [{ type: string }]) => msg.type === 'LOGOUT',
    )
    expect(logoutCall).toBeDefined()
  })

  it('transitions to "unauthenticated" after signOut', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockUser })
      }
      if (msg.type === 'LOGOUT') {
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'))

    await act(async () => { await result.current.signOut() })

    expect(result.current.state.status).toBe('unauthenticated')
  })

  it('transitions to "unauthenticated" even if LOGOUT request fails', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockUser })
      }
      if (msg.type === 'LOGOUT') {
        return Promise.resolve({ ok: false, error: 'Network error' })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'))

    await act(async () => { await result.current.signOut() })

    // signOut always sets unauthenticated regardless of LOGOUT response
    expect(result.current.state.status).toBe('unauthenticated')
  })
})
