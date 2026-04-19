import { describe, it, expect } from 'vitest'
import { isValidSocialValue, buildSocialUrl, normalizeSocialLinks } from './profile.js'
import type { SocialPlatform } from '../db/schema.js'

// ─── isValidSocialValue ───────────────────────────────────────────────────────

describe('isValidSocialValue', () => {
  describe('email platform', () => {
    it('accepts a valid email', () => {
      expect(isValidSocialValue('email', 'user@example.com')).toBe(true)
    })

    it('accepts email with subdomain', () => {
      expect(isValidSocialValue('email', 'user@mail.example.co.uk')).toBe(true)
    })

    it('rejects email missing @', () => {
      expect(isValidSocialValue('email', 'notanemail')).toBe(false)
    })

    it('rejects email missing domain', () => {
      expect(isValidSocialValue('email', 'user@')).toBe(false)
    })

    it('rejects email missing TLD', () => {
      expect(isValidSocialValue('email', 'user@domain')).toBe(false)
    })

    it('rejects empty string', () => {
      expect(isValidSocialValue('email', '')).toBe(false)
    })
  })

  describe('non-email platforms', () => {
    const platforms: SocialPlatform[] = ['github', 'linkedin', 'instagram', 'discord', 'hackerrank', 'codeforces']

    for (const platform of platforms) {
      it(`accepts a normal username for ${platform}`, () => {
        expect(isValidSocialValue(platform, 'cooluser123')).toBe(true)
      })

      it(`accepts a username with hyphens for ${platform}`, () => {
        expect(isValidSocialValue(platform, 'cool-user_123')).toBe(true)
      })

      it(`rejects empty string for ${platform}`, () => {
        expect(isValidSocialValue(platform, '')).toBe(false)
      })

      it(`rejects whitespace-only for ${platform}`, () => {
        expect(isValidSocialValue(platform, '   ')).toBe(false)
      })

      it(`rejects value exceeding 200 chars for ${platform}`, () => {
        expect(isValidSocialValue(platform, 'a'.repeat(201))).toBe(false)
      })

      it(`accepts value of exactly 200 chars for ${platform}`, () => {
        expect(isValidSocialValue(platform, 'a'.repeat(200))).toBe(true)
      })

      it(`rejects value containing newline for ${platform}`, () => {
        expect(isValidSocialValue(platform, 'user\nname')).toBe(false)
      })

      it(`rejects value containing carriage return for ${platform}`, () => {
        expect(isValidSocialValue(platform, 'user\rname')).toBe(false)
      })
    }
  })
})

// ─── buildSocialUrl ───────────────────────────────────────────────────────────

describe('buildSocialUrl', () => {
  it('builds github URL from username', () => {
    expect(buildSocialUrl('github', 'torvalds')).toBe('https://github.com/torvalds')
  })

  it('builds instagram URL from username', () => {
    expect(buildSocialUrl('instagram', 'testuser')).toBe('https://instagram.com/testuser')
  })

  it('builds linkedin URL from bare username', () => {
    expect(buildSocialUrl('linkedin', 'john-doe')).toBe('https://linkedin.com/in/john-doe')
  })

  it('passes through full linkedin URL unchanged', () => {
    const url = 'https://linkedin.com/in/john-doe'
    expect(buildSocialUrl('linkedin', url)).toBe(url)
  })

  it('builds hackerrank URL from username', () => {
    expect(buildSocialUrl('hackerrank', 'myhandle')).toBe('https://www.hackerrank.com/profile/myhandle')
  })

  it('builds codeforces URL from handle', () => {
    expect(buildSocialUrl('codeforces', 'tourist')).toBe('https://codeforces.com/profile/tourist')
  })

  it('builds mailto link for email', () => {
    expect(buildSocialUrl('email', 'user@example.com')).toBe('mailto:user@example.com')
  })

  it('returns null for discord (no linkable profile URL)', () => {
    expect(buildSocialUrl('discord', 'myuser')).toBeNull()
  })

  it('returns null for empty value', () => {
    expect(buildSocialUrl('github', '')).toBeNull()
  })

  it('trims whitespace before building URL', () => {
    expect(buildSocialUrl('github', '  octocat  ')).toBe('https://github.com/octocat')
  })
})

// ─── normalizeSocialLinks ─────────────────────────────────────────────────────

describe('normalizeSocialLinks', () => {
  it('returns valid links from a well-formed array', () => {
    const result = normalizeSocialLinks([
      { platform: 'github', value: 'octocat' },
      { platform: 'email', value: 'user@example.com' },
    ])
    expect(result).toEqual([
      { platform: 'github', value: 'octocat' },
      { platform: 'email', value: 'user@example.com' },
    ])
  })

  it('trims whitespace from values', () => {
    const result = normalizeSocialLinks([{ platform: 'github', value: '  octocat  ' }])
    expect(result[0]?.value).toBe('octocat')
  })

  it('drops unknown platform names', () => {
    const result = normalizeSocialLinks([{ platform: 'twitter', value: 'someone' }])
    expect(result).toHaveLength(0)
  })

  it('drops entries with invalid email format', () => {
    const result = normalizeSocialLinks([{ platform: 'email', value: 'not-an-email' }])
    expect(result).toHaveLength(0)
  })

  it('deduplicates: keeps first occurrence of a platform', () => {
    const result = normalizeSocialLinks([
      { platform: 'github', value: 'first' },
      { platform: 'github', value: 'second' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.value).toBe('first')
  })

  it('drops entries with empty values', () => {
    const result = normalizeSocialLinks([{ platform: 'github', value: '' }])
    expect(result).toHaveLength(0)
  })

  it('drops entries with value exceeding 200 chars', () => {
    const result = normalizeSocialLinks([{ platform: 'github', value: 'a'.repeat(201) }])
    expect(result).toHaveLength(0)
  })

  it('drops non-object entries silently', () => {
    const result = normalizeSocialLinks(['invalid', null, 42])
    expect(result).toHaveLength(0)
  })

  it('handles an empty array', () => {
    expect(normalizeSocialLinks([])).toEqual([])
  })

  it('accepts all seven supported platforms', () => {
    const input = [
      { platform: 'github', value: 'user' },
      { platform: 'linkedin', value: 'user' },
      { platform: 'instagram', value: 'user' },
      { platform: 'discord', value: 'user#1234' },
      { platform: 'hackerrank', value: 'user' },
      { platform: 'codeforces', value: 'user' },
      { platform: 'email', value: 'user@example.com' },
    ]
    const result = normalizeSocialLinks(input)
    expect(result).toHaveLength(7)
  })

  it('drops entry missing platform field', () => {
    const result = normalizeSocialLinks([{ value: 'user' }])
    expect(result).toHaveLength(0)
  })

  it('drops entry missing value field', () => {
    const result = normalizeSocialLinks([{ platform: 'github' }])
    expect(result).toHaveLength(0)
  })
})
