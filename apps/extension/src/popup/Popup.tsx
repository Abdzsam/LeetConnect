import React, { useEffect, useState, useCallback } from 'react'

interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

type PopupState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: AuthUser }

type SW = { ok: true; data?: unknown } | { ok: false; error: string }

async function send(msg: object): Promise<SW> {
  return chrome.runtime.sendMessage(msg) as Promise<SW>
}

const LC = {
  bg:        '#1a1a1a',
  surface:   '#282828',
  surfaceHi: '#333333',
  border:    'rgba(255,255,255,0.08)',
  orange:    '#ffa116',
  orangeDim: 'rgba(255,161,22,0.15)',
  teal:      '#00b8a3',
  red:       '#ef4743',
  redDim:    'rgba(239,71,67,0.15)',
  text:      '#eff1f6',
  textSub:   '#9ca3af',
  font:      'system-ui, -apple-system, sans-serif',
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Google icon ──────────────────────────────────────────────────────────────

const GoogleIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

// ─── Popup ────────────────────────────────────────────────────────────────────

export const Popup: React.FC = () => {
  const [state, setState] = useState<PopupState>({ status: 'loading' })
  const [signingIn, setSigningIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUser = useCallback(async () => {
    const statusRes = await send({ type: 'GET_AUTH_STATUS' })
    if (!statusRes.ok) { setState({ status: 'unauthenticated' }); return }
    const data = statusRes.data as { authenticated: boolean } | undefined
    if (!data?.authenticated) { setState({ status: 'unauthenticated' }); return }

    const userRes = await send({ type: 'GET_USER' })
    if (userRes.ok && userRes.data) {
      setState({ status: 'authenticated', user: userRes.data as AuthUser })
    } else {
      setState({ status: 'unauthenticated' })
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  const signIn = useCallback(async () => {
    setSigningIn(true)
    setError(null)
    const res = await send({ type: 'INITIATE_GOOGLE_AUTH' })
    if (res.ok) {
      await loadUser()
    } else {
      setError((res as { ok: false; error: string }).error ?? 'Sign-in failed')
      setState({ status: 'unauthenticated' })
    }
    setSigningIn(false)
  }, [loadUser])

  const signOut = useCallback(async () => {
    setSigningOut(true)
    await send({ type: 'LOGOUT' })
    setState({ status: 'unauthenticated' })
    setSigningOut(false)
  }, [])

  return (
    <div style={{
      width: 300,
      minHeight: 200,
      background: LC.bg,
      color: LC.text,
      fontFamily: LC.font,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: LC.surface,
        borderBottom: `1px solid ${LC.border}`,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `linear-gradient(135deg, ${LC.orange} 0%, #ff8c00 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#1a1a1a',
          letterSpacing: '-0.03em', flexShrink: 0,
        }}>LC</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, color: LC.text }}>LeetConnect</div>
          <div style={{ fontSize: 10, color: LC.textSub, marginTop: 1 }}>v0.1.0</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 16 }}>

        {/* Loading */}
        {state.status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: LC.textSub, fontSize: 13 }}>
            Connecting…
          </div>
        )}

        {/* Unauthenticated */}
        {state.status === 'unauthenticated' && (
          <>
            <p style={{ fontSize: 13, color: LC.textSub, margin: '0 0 14px', lineHeight: 1.6 }}>
              Sign in to connect with coders solving the same LeetCode problems.
            </p>

            {error && (
              <div style={{
                background: LC.redDim,
                border: `1px solid ${LC.red}`,
                borderRadius: 10, padding: '8px 12px', marginBottom: 12,
                fontSize: 12, color: '#ff6b6b',
              }}>
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={signIn}
              disabled={signingIn}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 16px',
                background: signingIn ? LC.surfaceHi : '#fff',
                border: `1px solid ${LC.border}`,
                borderRadius: 10, cursor: signingIn ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600,
                color: signingIn ? LC.textSub : '#111827',
                opacity: signingIn ? 0.7 : 1,
                transition: 'opacity 150ms',
              }}
            >
              {!signingIn && <GoogleIcon />}
              {signingIn ? 'Opening Google…' : 'Sign in with Google'}
            </button>
          </>
        )}

        {/* Authenticated */}
        {state.status === 'authenticated' && (
          <>
            {/* User card */}
            <div style={{
              background: LC.surface,
              border: `1px solid ${LC.border}`,
              borderRadius: 12, padding: '12px 14px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: state.user.avatarUrl ? 'transparent' : LC.orangeDim,
                border: `2px solid ${LC.orange}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: LC.orange,
                overflow: 'hidden',
              }}>
                {state.user.avatarUrl
                  ? <img src={state.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials(state.user.name)
                }
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: LC.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {state.user.name}
                </div>
                <div style={{ fontSize: 11, color: LC.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                  {state.user.email}
                </div>
              </div>
              <span style={{
                marginLeft: 'auto', flexShrink: 0,
                width: 8, height: 8, borderRadius: '50%', background: LC.teal,
              }} />
            </div>

            {/* Instruction */}
            <div style={{
              background: LC.surface,
              border: `1px solid ${LC.border}`,
              borderRadius: 10, padding: '10px 12px', marginBottom: 12,
            }}>
              <p style={{ fontSize: 12, color: LC.textSub, margin: 0, lineHeight: 1.6 }}>
                Click the{' '}
                <span style={{
                  display: 'inline-block', padding: '1px 7px', borderRadius: 6,
                  background: LC.orangeDim,
                  border: `1px solid ${LC.orange}`,
                  fontSize: 11, fontWeight: 700, color: LC.orange,
                }}>orange tab</span>
                {' '}on the right edge of any LeetCode problem page to open the panel.
              </p>
            </div>

            {/* Sign out */}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
                background: LC.redDim,
                cursor: signingOut ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, color: '#ff6b6b',
                opacity: signingOut ? 0.6 : 1, transition: 'opacity 150ms',
              }}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
