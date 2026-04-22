import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import type { RoomUser } from '../hooks/useProblemRoom.js'

// ─── Mock useSocialLinks ──────────────────────────────────────────────────────

const mockFetchUserProfile = vi.fn()

vi.mock('../hooks/useSocialLinks.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../hooks/useSocialLinks.js')>()
  return {
    ...original,
    useSocialLinks: () => ({
      links: [],
      loading: false,
      saving: false,
      error: null,
      fetchOwnLinks: vi.fn(),
      saveLinks: vi.fn(),
      fetchUserProfile: mockFetchUserProfile,
    }),
  }
})

const { UserProfileCard } = await import('./UserProfileCard.js')

const mockUser: RoomUser = {
  id: 'user-123',
  name: 'Alice Smith',
  avatarUrl: null,
}

beforeEach(() => {
  mockFetchUserProfile.mockReset()
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserProfileCard', () => {
  it('shows loading text while the profile is being fetched', () => {
    mockFetchUserProfile.mockReturnValue(new Promise(() => {}))
    render(<UserProfileCard user={mockUser} isOnline={true} onClose={vi.fn()} />)
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  it('renders the user name after the profile loads', async () => {
    mockFetchUserProfile.mockResolvedValue({ name: 'Alice Smith', bio: null, avatarUrl: null, links: [] })
    render(<UserProfileCard user={mockUser} isOnline={true} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeDefined())
  })

  it('shows "No socials linked yet." when the profile has no links', async () => {
    mockFetchUserProfile.mockResolvedValue({ name: 'Alice Smith', bio: null, avatarUrl: null, links: [] })
    render(<UserProfileCard user={mockUser} isOnline={true} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('No socials linked yet.')).toBeDefined())
  })

  it('renders a social link with correct platform label', async () => {
    mockFetchUserProfile.mockResolvedValue({
      name: 'Alice Smith', bio: null, avatarUrl: null,
      links: [{ platform: 'github', value: 'alice-dev' }],
    })
    render(<UserProfileCard user={mockUser} isOnline={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/github/i)).toBeDefined()
      expect(screen.getByText('alice-dev')).toBeDefined()
    })
  })

  it('renders a Discord entry without an anchor', async () => {
    mockFetchUserProfile.mockResolvedValue({
      name: 'Alice Smith', bio: null, avatarUrl: null,
      links: [{ platform: 'discord', value: 'alice#0001' }],
    })
    render(<UserProfileCard user={mockUser} isOnline={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('alice#0001')).toBeDefined()
      expect(screen.getByText('alice#0001').closest('a')).toBeNull()
    })
  })

  it('wraps non-Discord social links in an anchor tag', async () => {
    mockFetchUserProfile.mockResolvedValue({
      name: 'Alice Smith', bio: null, avatarUrl: null,
      links: [{ platform: 'github', value: 'alice-dev' }],
    })
    render(<UserProfileCard user={mockUser} isOnline={true} onClose={vi.fn()} />)
    await waitFor(() => {
      const anchor = screen.getByText('alice-dev').closest('a')
      expect(anchor).toBeDefined()
      expect((anchor as HTMLAnchorElement).href).toContain('github.com/alice-dev')
    })
  })

  it('shows "Solving now" when isOnline is true', async () => {
    mockFetchUserProfile.mockResolvedValue({ name: 'Alice', bio: null, avatarUrl: null, links: [] })
    render(<UserProfileCard user={mockUser} isOnline={true} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Solving now')).toBeDefined())
  })

  it('hides "Solving now" when isOnline is false', async () => {
    mockFetchUserProfile.mockResolvedValue({ name: 'Alice', bio: null, avatarUrl: null, links: [] })
    render(<UserProfileCard user={mockUser} isOnline={false} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.queryByText('Solving now')).toBeNull())
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    mockFetchUserProfile.mockResolvedValue({ name: 'Alice', bio: null, avatarUrl: null, links: [] })
    const { container } = render(<UserProfileCard user={mockUser} isOnline={true} onClose={onClose} />)
    await waitFor(() => screen.getByText('Alice Smith'))
    fireEvent.click(container.firstElementChild as HTMLElement)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    mockFetchUserProfile.mockResolvedValue({ name: 'Alice', bio: null, avatarUrl: null, links: [] })
    render(<UserProfileCard user={mockUser} isOnline={true} onClose={onClose} />)
    await waitFor(() => screen.getByText('Alice Smith'))
    fireEvent.click(document.querySelector('button') as HTMLButtonElement)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
