import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// ─── Mock useAuth ─────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn()

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => mockUseAuth(),
}))

const { AuthGate } = await import('./AuthGate.js')

beforeEach(() => {
  mockUseAuth.mockReset()
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthGate', () => {
  it('renders a loading indicator when status is "loading"', () => {
    mockUseAuth.mockReturnValue({ state: { status: 'loading' }, signIn: vi.fn() })
    render(<AuthGate><div>children</div></AuthGate>)
    // LoadingView shows "Connecting…"
    expect(screen.getByText('Connecting…')).toBeDefined()
  })

  it('does not render children when loading', () => {
    mockUseAuth.mockReturnValue({ state: { status: 'loading' }, signIn: vi.fn() })
    render(<AuthGate><div data-testid="child">children</div></AuthGate>)
    expect(screen.queryByTestId('child')).toBeNull()
  })

  it('renders the sign-in button when status is "unauthenticated"', () => {
    mockUseAuth.mockReturnValue({ state: { status: 'unauthenticated' }, signIn: vi.fn() })
    render(<AuthGate><div>children</div></AuthGate>)
    expect(screen.getByText(/sign in with google/i)).toBeDefined()
  })

  it('does not render children when unauthenticated', () => {
    mockUseAuth.mockReturnValue({ state: { status: 'unauthenticated' }, signIn: vi.fn() })
    render(<AuthGate><div data-testid="child">children</div></AuthGate>)
    expect(screen.queryByTestId('child')).toBeNull()
  })

  it('calls signIn when the sign-in button is clicked', () => {
    const signIn = vi.fn()
    mockUseAuth.mockReturnValue({ state: { status: 'unauthenticated' }, signIn })
    render(<AuthGate><div>children</div></AuthGate>)
    fireEvent.click(screen.getByText(/sign in with google/i))
    expect(signIn).toHaveBeenCalledOnce()
  })

  it('renders children when status is "authenticated"', () => {
    mockUseAuth.mockReturnValue({
      state: { status: 'authenticated', user: { id: 'u1', name: 'Alice', email: 'a@b.com', avatarUrl: null } },
      signIn: vi.fn(),
    })
    render(<AuthGate><div data-testid="child">Hello</div></AuthGate>)
    expect(screen.getByTestId('child')).toBeDefined()
  })

  it('does not render the sign-in button when authenticated', () => {
    mockUseAuth.mockReturnValue({
      state: { status: 'authenticated', user: { id: 'u1', name: 'Alice', email: 'a@b.com', avatarUrl: null } },
      signIn: vi.fn(),
    })
    render(<AuthGate><div>Hello</div></AuthGate>)
    expect(screen.queryByText(/sign in with google/i)).toBeNull()
  })
})
