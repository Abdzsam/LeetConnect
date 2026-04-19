import React, { useEffect, useState } from 'react'
import { useSocialLinks, buildSocialUrl, PLATFORM_META, type UserProfile, type SocialPlatform } from '../hooks/useSocialLinks'
import type { RoomUser } from '../hooks/useProblemRoom'

const LC = {
  bg:        '#1a1a1a',
  surface:   '#282828',
  surfaceHi: '#333333',
  border:    'rgba(255,255,255,0.08)',
  orange:    '#ffa116',
  orangeDim: 'rgba(255,161,22,0.15)',
  teal:      '#00b8a3',
  text:      '#eff1f6',
  textSub:   '#9ca3af',
  textMuted: '#6b7280',
  font:      'system-ui, -apple-system, sans-serif',
}

// ─── Platform icons (small) ───────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  github: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  ),
  linkedin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  instagram: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  discord: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  ),
  hackerrank: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm-.295 16.646l-.003-.003c-.553.528-1.284.822-2.053.822-.831 0-1.59-.326-2.148-.857-.558-.53-.877-1.264-.877-2.073V9.464c0-.81.32-1.543.877-2.073.558-.53 1.317-.857 2.148-.857.769 0 1.5.294 2.053.822l.003-.003.001.003c.27.258.27.677 0 .935l-.668.636c-.136.13-.312.194-.489.194-.177 0-.353-.065-.49-.194l-.001-.002a.773.773 0 00-.409-.121.771.771 0 00-.52.2c-.138.13-.22.313-.22.507v4.072c0 .194.082.377.22.507a.771.771 0 00.52.2.773.773 0 00.41-.122l.001-.001c.136-.13.312-.194.489-.194.177 0 .353.065.489.194l.668.636c.27.258.27.677 0 .935l-.001.003zm4.39 0l-.001-.001a.663.663 0 01-.937 0l-.668-.636a.65.65 0 010-.935l.001-.001.003-.002v-2.49h-2.032v2.49l.003.003a.65.65 0 010 .935l-.668.636a.663.663 0 01-.937 0l-.001-.003a.65.65 0 010-.935l.003-.002V7.292l-.003-.003a.65.65 0 010-.935l.668-.636a.663.663 0 01.937 0l.001.003a.65.65 0 010 .935l-.003.002v2.49h2.032v-2.49l-.003-.002a.65.65 0 010-.935l.001-.003a.663.663 0 01.937 0l.668.636a.65.65 0 010 .935l-.003.003v9.354l.003.002a.65.65 0 010 .935l-.668.636-.001.003z" />
    </svg>
  ),
  codeforces: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.5 7.5A1.5 1.5 0 013 6V3a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 019 3v3a1.5 1.5 0 01-1.5 1.5h-3zm0 13.5A1.5 1.5 0 013 19.5v-9A1.5 1.5 0 014.5 9h3A1.5 1.5 0 019 10.5v9A1.5 1.5 0 017.5 21h-3zm8.5-8a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 0113 1h3a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0116 13h-3zm0 8a1.5 1.5 0 01-1.5-1.5v-3A1.5 1.5 0 0113 15h3a1.5 1.5 0 011.5 1.5v3A1.5 1.5 0 0116 21h-3z" />
    </svg>
  ),
  email: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
    </svg>
  ),
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

// ─── UserProfileCard ──────────────────────────────────────────────────────────

export const UserProfileCard: React.FC<{
  user: RoomUser
  isOnline: boolean
  onClose: () => void
}> = ({ user, isOnline, onClose }) => {
  const { fetchUserProfile } = useSocialLinks()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchUserProfile(user.id).then((p) => {
      setProfile(p)
      setLoading(false)
    })
  }, [user.id, fetchUserProfile])

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10, padding: 16,
      }}
    >
      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: LC.surface,
          border: `1px solid ${LC.border}`,
          borderRadius: 14,
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Card header */}
        <div style={{
          background: LC.bg,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: `1px solid ${LC.border}`,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: user.avatarUrl ? 'transparent' : LC.orangeDim,
            border: `2px solid ${LC.orange}`,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: LC.orange,
          }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials(user.name)
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: LC.text, fontFamily: LC.font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </div>
            {isOnline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: LC.teal, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 11, color: LC.textSub, fontFamily: LC.font }}>Solving now</span>
              </div>
            )}
            {profile?.bio && (
              <div style={{
                fontSize: 11, color: LC.textSub, fontFamily: LC.font,
                marginTop: 6, lineHeight: 1.5,
                display: '-webkit-box', WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {profile.bio}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 26, height: 26, borderRadius: 7,
              background: 'transparent', border: `1px solid ${LC.border}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={LC.textSub} strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Socials */}
        <div style={{ padding: '12px 16px' }}>
          {loading ? (
            <p style={{ fontSize: 12, color: LC.textSub, fontFamily: LC.font, margin: 0 }}>Loading…</p>
          ) : !profile || profile.links.length === 0 ? (
            <p style={{ fontSize: 12, color: LC.textMuted, fontFamily: LC.font, margin: 0, textAlign: 'center', padding: '8px 0' }}>
              No socials linked yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {profile.links.map(({ platform, value }) => {
                const url = buildSocialUrl(platform as SocialPlatform, value)
                const meta = PLATFORM_META[platform as SocialPlatform]
                const content = (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px',
                    background: LC.surfaceHi,
                    border: `1px solid ${LC.border}`,
                    borderRadius: 8,
                    color: LC.orange,
                    textDecoration: 'none',
                    cursor: url ? 'pointer' : 'default',
                  }}>
                    <span style={{ color: LC.orange, display: 'flex', alignItems: 'center' }}>
                      {PLATFORM_ICONS[platform]}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 10, color: LC.textMuted, fontFamily: LC.font, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                        {meta?.label ?? platform}
                      </div>
                      <div style={{ fontSize: 12, color: LC.text, fontFamily: LC.font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                        {value}
                      </div>
                    </div>
                    {url && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={LC.textMuted} strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    )}
                  </div>
                )
                return url ? (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    {content}
                  </a>
                ) : (
                  <div key={platform}>{content}</div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
