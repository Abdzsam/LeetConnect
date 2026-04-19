import { useState, useCallback } from 'react'

declare const __SERVER_URL__: string
const SERVER_URL = __SERVER_URL__

export const SOCIAL_PLATFORMS = [
  'github', 'linkedin', 'instagram', 'discord',
  'hackerrank', 'codeforces', 'email',
] as const
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number]

export interface SocialLink {
  platform: SocialPlatform
  value: string
}

export interface UserProfile {
  name: string
  bio: string | null
  avatarUrl: string | null
  links: SocialLink[]
}

export const PLATFORM_META: Record<SocialPlatform, { label: string; placeholder: string }> = {
  github:     { label: 'GitHub',     placeholder: 'username' },
  linkedin:   { label: 'LinkedIn',   placeholder: 'username or profile URL' },
  instagram:  { label: 'Instagram',  placeholder: 'username' },
  discord:    { label: 'Discord',    placeholder: 'username' },
  hackerrank: { label: 'HackerRank', placeholder: 'username' },
  codeforces: { label: 'Codeforces', placeholder: 'handle' },
  email:      { label: 'Email',      placeholder: 'you@example.com' },
}

export function buildSocialUrl(platform: SocialPlatform, value: string): string | null {
  const v = value.trim()
  if (!v) return null
  switch (platform) {
    case 'github':     return `https://github.com/${v}`
    case 'linkedin':   return v.startsWith('http') ? v : `https://linkedin.com/in/${v}`
    case 'instagram':  return `https://instagram.com/${v}`
    case 'discord':    return null
    case 'hackerrank': return `https://www.hackerrank.com/profile/${v}`
    case 'codeforces': return `https://codeforces.com/profile/${v}`
    case 'email':      return `mailto:${v}`
    default:           return null
  }
}

async function getStoredToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('accessToken', (r) => {
      resolve((r['accessToken'] as string | null | undefined) ?? null)
    })
  })
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getStoredToken()
  return fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

export function useSocialLinks() {
  const [links, setLinks] = useState<SocialLink[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOwnLinks = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await authedFetch('/profile/socials')
      if (!res.ok) { setError('Failed to load links'); return }
      const data = (await res.json()) as { ok: boolean; links: SocialLink[] }
      if (data.ok) setLinks(data.links)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  const saveLinks = useCallback(async (newLinks: SocialLink[]): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const res = await authedFetch('/profile/socials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: newLinks }),
      })
      if (!res.ok) { setError('Failed to save links'); return false }
      const data = (await res.json()) as { ok: boolean; links: SocialLink[] }
      if (data.ok) setLinks(data.links)
      return true
    } catch {
      setError('Network error')
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const res = await fetch(`${SERVER_URL}/users/${userId}/socials`)
      if (!res.ok) return null
      const data = (await res.json()) as { ok: boolean } & UserProfile
      return data.ok ? { name: data.name, bio: data.bio ?? null, avatarUrl: data.avatarUrl, links: data.links } : null
    } catch {
      return null
    }
  }, [])

  const fetchOwnProfile = useCallback(async (): Promise<{ name: string; bio: string | null; avatarUrl: string | null } | null> => {
    try {
      const res = await authedFetch('/profile')
      if (!res.ok) return null
      const data = (await res.json()) as { ok: boolean; name: string; bio: string | null; avatarUrl: string | null }
      return data.ok ? { name: data.name, bio: data.bio ?? null, avatarUrl: data.avatarUrl } : null
    } catch {
      return null
    }
  }, [])

  const saveProfile = useCallback(async (bio: string): Promise<boolean> => {
    try {
      const res = await authedFetch('/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio }),
      })
      return res.ok
    } catch {
      return false
    }
  }, [])

  return { links, loading, saving, error, fetchOwnLinks, saveLinks, fetchUserProfile, fetchOwnProfile, saveProfile }
}
