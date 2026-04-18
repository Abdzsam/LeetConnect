import React, { useEffect, useState } from 'react'

type AuthStatus = {
  authenticated: boolean
  userId: string | null
} | null

export const Popup: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(null)
  const [loading, setLoading] = useState(true)
  const [pingOk, setPingOk] = useState<boolean | null>(null)

  useEffect(() => {
    // Ping the service worker to confirm it's alive
    chrome.runtime.sendMessage({ type: 'PING' }, (response: { ok: boolean } | undefined) => {
      if (chrome.runtime.lastError) {
        setPingOk(false)
      } else {
        setPingOk(Boolean(response?.ok))
      }
    })

    // Fetch auth status
    chrome.runtime.sendMessage(
      { type: 'GET_AUTH_STATUS' },
      (response: { ok: boolean; data?: { authenticated: boolean; userId: string | null } }) => {
        if (chrome.runtime.lastError || !response?.ok) {
          setLoading(false)
          return
        }
        if (response.data) {
          setAuthStatus(response.data)
        }
        setLoading(false)
      },
    )
  }, [])

  return (
    <div
      style={{
        width: 280,
        minHeight: 180,
        background: '#1a1a2e',
        color: '#f3f4f6',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.4) 0%, rgba(79,70,229,0.25) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.03em',
            flexShrink: 0,
          }}
        >
          LC
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>LeetConnect</div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>v0.1.0</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 16 }}>
        {/* Panel status card */}
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22c55e',
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 12, color: '#86efac' }}>
            Panel active on this page
          </span>
        </div>

        {/* Instruction card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 12, color: '#d1d5db', margin: 0, lineHeight: 1.6 }}>
            Click the{' '}
            <span
              style={{
                display: 'inline-block',
                padding: '1px 7px',
                borderRadius: 6,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              purple tab
            </span>
            {' '}on the right edge of any page to open the collaboration panel.
          </p>
        </div>

        {/* Service worker status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Service worker</span>
          {pingOk === null ? (
            <span style={{ fontSize: 11, color: '#6b7280' }}>checking…</span>
          ) : pingOk ? (
            <span style={{ fontSize: 11, color: '#22c55e' }}>running</span>
          ) : (
            <span style={{ fontSize: 11, color: '#f87171' }}>offline</span>
          )}
        </div>

        {/* Auth status */}
        {!loading && (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 11, color: '#9ca3af' }}>Auth</span>
            <span
              style={{
                fontSize: 11,
                color: authStatus?.authenticated ? '#22c55e' : '#9ca3af',
              }}
            >
              {authStatus?.authenticated ? `signed in` : 'not signed in'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
