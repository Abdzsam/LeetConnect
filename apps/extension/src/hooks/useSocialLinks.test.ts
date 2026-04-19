import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildSocialUrl, PLATFORM_META, SOCIAL_PLATFORMS } from './useSocialLinks'
import type { SocialPlatform } from './useSocialLinks'

// ─── buildSocialUrl ───────────────────────────────────────────────────────────

describe('buildSocialUrl', () => {
  it('builds github URL from username', () => {
    expect(buildSocialUrl('github', 'octocat')).toBe('https://github.com/octocat')
  })

  it('builds instagram URL from username', () => {
    expect(buildSocialUrl('instagram', 'testuser')).toBe('https://instagram.com/testuser')
  })

  it('builds linkedin URL from bare username', () => {
    expect(buildSocialUrl('linkedin', 'john-doe')).toBe('https://linkedin.com/in/john-doe')
  })

  it('passes through a full linkedin https URL unchanged', () => {
    const url = 'https://linkedin.com/in/john-doe'
    expect(buildSocialUrl('linkedin', url)).toBe(url)
  })

  it('builds hackerrank URL from username', () => {
    expect(buildSocialUrl('hackerrank', 'coder')).toBe('https://www.hackerrank.com/profile/coder')
  })

  it('builds codeforces URL from handle', () => {
    expect(buildSocialUrl('codeforces', 'tourist')).toBe('https://codeforces.com/profile/tourist')
  })

  it('builds mailto link for email', () => {
    expect(buildSocialUrl('email', 'user@example.com')).toBe('mailto:user@example.com')
  })

  it('returns null for discord (no linkable profile URL)', () => {
    expect(buildSocialUrl('discord', 'myuser#1234')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(buildSocialUrl('github', '')).toBeNull()
  })

  it('trims surrounding whitespace before building URL', () => {
    expect(buildSocialUrl('github', '  octocat  ')).toBe('https://github.com/octocat')
  })

  it('trims whitespace before checking empty', () => {
    expect(buildSocialUrl('github', '   ')).toBeNull()
  })
})

// ─── PLATFORM_META completeness ───────────────────────────────────────────────

describe('PLATFORM_META', () => {
  it('has an entry for every platform in SOCIAL_PLATFORMS', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(PLATFORM_META[platform], `missing meta for ${platform}`).toBeDefined()
    }
  })

  it('every entry has a non-empty label', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(PLATFORM_META[platform].label.length).toBeGreaterThan(0)
    }
  })

  it('every entry has a non-empty placeholder', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(PLATFORM_META[platform].placeholder.length).toBeGreaterThan(0)
    }
  })
})

// ─── SOCIAL_PLATFORMS list ────────────────────────────────────────────────────

describe('SOCIAL_PLATFORMS', () => {
  const EXPECTED: SocialPlatform[] = [
    'github', 'linkedin', 'instagram', 'discord', 'hackerrank', 'codeforces', 'email',
  ]

  it('contains all seven expected platforms', () => {
    expect([...SOCIAL_PLATFORMS].sort()).toEqual([...EXPECTED].sort())
  })

  it('has no duplicate entries', () => {
    const set = new Set(SOCIAL_PLATFORMS)
    expect(set.size).toBe(SOCIAL_PLATFORMS.length)
  })
})

// ─── fetchOwnLinks (integration-style, fetch mocked) ─────────────────────────

describe('useSocialLinks fetch helpers', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
    // chrome.storage.local.get stub already in test-setup.ts
    vi.spyOn(chrome.storage.local, 'get').mockImplementation(
      (_key, cb) => { (cb as (r: Record<string, unknown>) => void)({ accessToken: 'test-token' }); return undefined as unknown as Promise<void> }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetchUserProfile calls correct endpoint and parses response', async () => {
    const profile = { ok: true, name: 'Alice', avatarUrl: null, links: [{ platform: 'github', value: 'alice' }] }
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => profile })

    // Import dynamically so __SERVER_URL__ is resolved via vitest define
    const { useSocialLinks } = await import('./useSocialLinks')

    let result: Awaited<ReturnType<ReturnType<typeof useSocialLinks>['fetchUserProfile']>>
    const { renderHook } = await import('@testing-library/react')
    const { result: hookResult } = renderHook(() => useSocialLinks())

    const { act } = await import('@testing-library/react')
    await act(async () => {
      result = await hookResult.current.fetchUserProfile('00000000-0000-0000-0000-000000000001')
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/00000000-0000-0000-0000-000000000001/socials'),
    )
    expect(result!).toEqual({ name: 'Alice', avatarUrl: null, links: [{ platform: 'github', value: 'alice' }] })
  })

  it('fetchUserProfile returns null on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const { useSocialLinks } = await import('./useSocialLinks')
    const { renderHook } = await import('@testing-library/react')
    const { result: hookResult } = renderHook(() => useSocialLinks())

    let result: Awaited<ReturnType<ReturnType<typeof useSocialLinks>['fetchUserProfile']>>
    const { act } = await import('@testing-library/react')
    await act(async () => {
      result = await hookResult.current.fetchUserProfile('00000000-0000-0000-0000-000000000002')
    })
    expect(result!).toBeNull()
  })

  it('fetchUserProfile returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network fail'))

    const { useSocialLinks } = await import('./useSocialLinks')
    const { renderHook } = await import('@testing-library/react')
    const { result: hookResult } = renderHook(() => useSocialLinks())

    let result: Awaited<ReturnType<ReturnType<typeof useSocialLinks>['fetchUserProfile']>>
    const { act } = await import('@testing-library/react')
    await act(async () => {
      result = await hookResult.current.fetchUserProfile('00000000-0000-0000-0000-000000000003')
    })
    expect(result!).toBeNull()
  })
})
