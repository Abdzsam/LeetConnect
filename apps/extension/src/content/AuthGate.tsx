import React from 'react'
import { useAuth } from '../hooks/useAuth'

// ─── Loading view ─────────────────────────────────────────────────────────────

const LoadingView: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 16,
      padding: 24,
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        fontWeight: 800,
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: '-0.03em',
        animation: 'lc-pulse 1.5s ease-in-out infinite',
        boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)',
      }}
    >
      LC
    </div>
    <p
      style={{
        fontSize: 13,
        color: '#9ca3af',
        fontFamily: 'system-ui, sans-serif',
        margin: 0,
      }}
    >
      Connecting…
    </p>
  </div>
)

// ─── Sign-in view ─────────────────────────────────────────────────────────────

const GoogleIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
)

const SignInView: React.FC<{ onSignIn: () => void }> = ({ onSignIn }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '24px 20px',
      textAlign: 'center',
    }}
  >
    {/* Logo */}
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        fontWeight: 800,
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: '-0.04em',
        boxShadow: '0 8px 32px rgba(124, 58, 237, 0.45)',
        marginBottom: 20,
      }}
    >
      LC
    </div>

    {/* Title */}
    <h2
      style={{
        fontSize: 18,
        fontWeight: 700,
        color: '#f3f4f6',
        fontFamily: 'system-ui, sans-serif',
        margin: '0 0 8px',
        lineHeight: 1.3,
      }}
    >
      LeetConnect
    </h2>
    <p
      style={{
        fontSize: 13,
        color: '#9ca3af',
        fontFamily: 'system-ui, sans-serif',
        margin: '0 0 32px',
        lineHeight: 1.6,
        maxWidth: 220,
      }}
    >
      Connect with coders solving the same problems in real time.
    </p>

    {/* Sign-in button */}
    <button
      type="button"
      onClick={onSignIn}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 20px',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        color: '#111827',
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        transition: 'box-shadow 150ms, transform 150ms',
        width: '100%',
        justifyContent: 'center',
        maxWidth: 260,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.12)'
      }}
    >
      <GoogleIcon />
      Sign in with Google
    </button>

    {/* Footer note */}
    <p
      style={{
        marginTop: 20,
        fontSize: 11,
        color: '#6b7280',
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.5,
        maxWidth: 220,
      }}
    >
      By signing in you agree to our terms of service.
    </p>
  </div>
)

// ─── AuthGate ─────────────────────────────────────────────────────────────────

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, signIn } = useAuth()

  if (state.status === 'loading') return <LoadingView />
  if (state.status === 'unauthenticated') return <SignInView onSignIn={signIn} />
  return <>{children}</>
}
