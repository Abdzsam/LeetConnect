import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// ─── Mock useSocialLinks ──────────────────────────────────────────────────────

const mockUseSocialLinks = vi.fn()

vi.mock('../hooks/useSocialLinks.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../hooks/useSocialLinks.js')>()
  return {
    ...original,
    useSocialLinks: () => mockUseSocialLinks(),
  }
})

const { ProfileEditor } = await import('./ProfileEditor.js')

function buildDefaultHook(overrides: Partial<ReturnType<typeof mockUseSocialLinks>> = {}) {
  return {
    links: [],
    loading: false,
    saving: false,
    error: null,
    fetchOwnLinks: vi.fn().mockResolvedValue(undefined),
    saveLinks: vi.fn().mockResolvedValue(true),
    saveProfile: vi.fn().mockResolvedValue(true),
    fetchOwnProfile: vi.fn().mockResolvedValue({ name: 'Test', bio: null, avatarUrl: null }),
    ...overrides,
  }
}

beforeEach(() => {
  mockUseSocialLinks.mockReset()
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProfileEditor', () => {
  it('renders inputs for all 7 platforms', () => {
    mockUseSocialLinks.mockReturnValue(buildDefaultHook())
    render(<ProfileEditor onBack={vi.fn()} />)
    expect(screen.getByText('GitHub')).toBeDefined()
    expect(screen.getByText('LinkedIn')).toBeDefined()
    expect(screen.getByText('Instagram')).toBeDefined()
    expect(screen.getByText('Discord')).toBeDefined()
    expect(screen.getByText('HackerRank')).toBeDefined()
    expect(screen.getByText('Codeforces')).toBeDefined()
    expect(screen.getByText('Email')).toBeDefined()
  })

  it('renders bio textarea', () => {
    mockUseSocialLinks.mockReturnValue(buildDefaultHook())
    render(<ProfileEditor onBack={vi.fn()} />)
    expect(screen.getByPlaceholderText(/tell people/i)).toBeDefined()
  })

  it('calls fetchOwnLinks on mount', async () => {
    const fetchOwnLinks = vi.fn().mockResolvedValue(undefined)
    mockUseSocialLinks.mockReturnValue(buildDefaultHook({ fetchOwnLinks }))
    render(<ProfileEditor onBack={vi.fn()} />)
    await waitFor(() => expect(fetchOwnLinks).toHaveBeenCalledOnce())
  })

  it('pre-fills inputs from existing links', async () => {
    mockUseSocialLinks.mockReturnValue(
      buildDefaultHook({
        links: [{ platform: 'github', value: 'myuser' }],
      }),
    )
    render(<ProfileEditor onBack={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    const githubInput = inputs.find((i) => i.value === 'myuser')
    expect(githubInput).toBeDefined()
  })

  it('shows "Saved!" after a successful save', async () => {
    const saveLinks = vi.fn().mockResolvedValue(true)
    const saveProfile = vi.fn().mockResolvedValue(true)
    mockUseSocialLinks.mockReturnValue(buildDefaultHook({ saveLinks, saveProfile }))
    render(<ProfileEditor onBack={vi.fn()} />)

    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(screen.getByText('Saved!')).toBeDefined())
  })

  it('calls saveLinks with the current draft values when Save is clicked', async () => {
    const saveLinks = vi.fn().mockResolvedValue(true)
    mockUseSocialLinks.mockReturnValue(
      buildDefaultHook({
        links: [{ platform: 'github', value: 'alice' }],
        saveLinks,
      }),
    )
    render(<ProfileEditor onBack={vi.fn()} />)

    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(saveLinks).toHaveBeenCalledOnce()
      const arg = (saveLinks.mock.calls[0] as unknown[])[0] as Array<{ platform: string; value: string }>
      expect(arg.some((l) => l.platform === 'github' && l.value === 'alice')).toBe(true)
    })
  })

  it('shows an error message when error is set', () => {
    mockUseSocialLinks.mockReturnValue(buildDefaultHook({ error: 'Failed to save links' }))
    render(<ProfileEditor onBack={vi.fn()} />)
    expect(screen.getByText('Failed to save links')).toBeDefined()
  })

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn()
    mockUseSocialLinks.mockReturnValue(buildDefaultHook())
    render(<ProfileEditor onBack={onBack} />)
    const header = screen.getByText('My Profile')
    const backBtn = header.parentElement?.querySelector('button') as HTMLButtonElement
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows a loading indicator when loading is true', () => {
    mockUseSocialLinks.mockReturnValue(buildDefaultHook({ loading: true }))
    render(<ProfileEditor onBack={vi.fn()} />)
    expect(screen.getByText('Loading…')).toBeDefined()
  })
})
