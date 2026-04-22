import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// ─── Mock chrome.runtime.sendMessage ─────────────────────────────────────────
// The Popup uses `chrome.runtime.sendMessage` directly (not via useAuth).

const mockSendMessage = vi.fn()
;(
  globalThis as unknown as { chrome: { runtime: { sendMessage: typeof mockSendMessage } } }
).chrome.runtime.sendMessage = mockSendMessage

// ─── Import after mock is installed ──────────────────────────────────────────

const { Popup } = await import('./Popup.js')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockAuthUser = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice',
  avatarUrl: null,
}

beforeEach(() => {
  mockSendMessage.mockReset()
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Popup', () => {
  it('renders a loading/connecting indicator on initial mount before messages resolve', () => {
    // Keep GET_AUTH_STATUS pending so the component stays in loading state
    mockSendMessage.mockReturnValue(new Promise(() => {}))
    render(<Popup />)
    expect(screen.getByText('Connecting…')).toBeDefined()
  })

  it('renders the sign-in button when unauthenticated', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: false } })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })
    render(<Popup />)
    await waitFor(() => expect(screen.getByText(/sign in with google/i)).toBeDefined())
  })

  it('calls INITIATE_GOOGLE_AUTH when the sign-in button is clicked', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: false } })
      }
      if (msg.type === 'INITIATE_GOOGLE_AUTH') {
        return Promise.resolve({ ok: false, error: 'cancelled' })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    render(<Popup />)
    await waitFor(() => screen.getByText(/sign in with google/i))
    fireEvent.click(screen.getByText(/sign in with google/i))
    await waitFor(() => {
      const initiateCall = mockSendMessage.mock.calls.find(
        (c) => (c[0] as { type?: string }).type === 'INITIATE_GOOGLE_AUTH',
      )
      expect(initiateCall).toBeDefined()
    })
  })

  it('renders the user name when authenticated', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockAuthUser })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })
    render(<Popup />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeDefined())
  })

  it('renders the user email when authenticated', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockAuthUser })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })
    render(<Popup />)
    await waitFor(() => expect(screen.getByText('alice@example.com')).toBeDefined())
  })

  it('calls LOGOUT when the sign-out button is clicked', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockAuthUser })
      }
      if (msg.type === 'LOGOUT') {
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    render(<Popup />)
    await waitFor(() => screen.getByText(/sign out/i))
    fireEvent.click(screen.getByText(/sign out/i))
    await waitFor(() => {
      const logoutCall = mockSendMessage.mock.calls.find(
        (c) => (c[0] as { type?: string }).type === 'LOGOUT',
      )
      expect(logoutCall).toBeDefined()
    })
  })

  it('shows unauthenticated state after sign-out', async () => {
    mockSendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'GET_AUTH_STATUS') {
        return Promise.resolve({ ok: true, data: { authenticated: true } })
      }
      if (msg.type === 'GET_USER') {
        return Promise.resolve({ ok: true, data: mockAuthUser })
      }
      if (msg.type === 'LOGOUT') {
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve({ ok: false, error: 'unexpected' })
    })

    render(<Popup />)
    await waitFor(() => screen.getByText(/sign out/i))
    fireEvent.click(screen.getByText(/sign out/i))
    // After logout the component sets state to unauthenticated
    await waitFor(() => expect(screen.queryByText('Alice')).toBeNull())
  })
})
