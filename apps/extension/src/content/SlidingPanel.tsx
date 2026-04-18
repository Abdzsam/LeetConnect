import React, { useState, useCallback, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnlineUser {
  id: string
  name: string
  problem: string
  avatar: string
  status: 'solving' | 'reviewing' | 'idle'
}

interface ChatMessage {
  id: string
  author: string
  text: string
  ts: number
}

// ─── Mock data (replaced by real data once backend is wired) ─────────────────

const MOCK_USERS: OnlineUser[] = [
  { id: '1', name: 'alex_codes', problem: 'Two Sum', avatar: 'AC', status: 'solving' },
  { id: '2', name: 'priya_dev', problem: 'LRU Cache', avatar: 'PD', status: 'reviewing' },
  { id: '3', name: 'marco_p', problem: 'Binary Search', avatar: 'MP', status: 'idle' },
]

const MOCK_MESSAGES: ChatMessage[] = [
  { id: '1', author: 'alex_codes', text: 'Anyone working on dp problems?', ts: Date.now() - 120000 },
  { id: '2', author: 'priya_dev', text: 'Yes! Just finished coin change', ts: Date.now() - 90000 },
  { id: '3', author: 'marco_p', text: 'Good luck everyone 🚀', ts: Date.now() - 30000 },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusDot: React.FC<{ status: OnlineUser['status'] }> = ({ status }) => {
  const colors: Record<OnlineUser['status'], string> = {
    solving: '#22c55e',
    reviewing: '#f59e0b',
    idle: '#6b7280',
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: colors[status],
        flexShrink: 0,
        ...(status === 'solving' ? { animation: 'lc-pulse 2s ease-in-out infinite' } : {}),
      }}
    />
  )
}

const Avatar: React.FC<{ initials: string }> = ({ initials }) => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      fontWeight: 700,
      color: '#fff',
      flexShrink: 0,
      fontFamily: 'system-ui, sans-serif',
      letterSpacing: '0.05em',
    }}
  >
    {initials}
  </div>
)

function formatTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

const SectionCard: React.FC<{
  title: string
  icon: React.ReactNode
  badge?: number
  children: React.ReactNode
}> = ({ title, icon, badge, children }) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 12,
    }}
  >
    {/* Card header */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span style={{ color: '#a78bfa', display: 'flex' }}>{icon}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#e5e7eb',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontFamily: 'system-ui, sans-serif',
          flex: 1,
        }}
      >
        {title}
      </span>
      {badge !== undefined && (
        <span
          style={{
            background: 'rgba(124, 58, 237, 0.3)',
            color: '#c4b5fd',
            fontSize: 11,
            fontWeight: 600,
            padding: '1px 7px',
            borderRadius: 10,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {badge}
        </span>
      )}
    </div>
    {/* Card body */}
    <div style={{ padding: '10px 14px' }}>{children}</div>
  </div>
)

// ─── Online users section ─────────────────────────────────────────────────────

const OnlineSection: React.FC = () => (
  <SectionCard
    title="Online Now"
    icon={
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    }
    badge={MOCK_USERS.length}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {MOCK_USERS.map((user) => (
        <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={user.avatar} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <StatusDot status={user.status} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#f3f4f6',
                  fontFamily: 'system-ui, sans-serif',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#9ca3af',
                fontFamily: 'system-ui, sans-serif',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 1,
              }}
            >
              {user.problem}
            </div>
          </div>
        </div>
      ))}
    </div>
  </SectionCard>
)

// ─── Chat section ─────────────────────────────────────────────────────────────

const ChatSection: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), author: 'you', text, ts: Date.now() },
    ])
    setDraft('')
  }, [draft])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  return (
    <SectionCard
      title="Problem Chat"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      }
    >
      {/* Message list */}
      <div
        className="lc-scrollbar"
        style={{
          maxHeight: 180,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginBottom: 10,
        }}
      >
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Avatar initials={msg.author.slice(0, 2).toUpperCase()} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#a78bfa',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  {msg.author}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: '#6b7280',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  {formatTime(msg.ts)}
                </span>
              </div>
              {/* Use textContent equivalent — set via text node, not innerHTML */}
              <p
                style={{
                  fontSize: 12,
                  color: '#d1d5db',
                  margin: 0,
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                {msg.text}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message…"
          maxLength={500}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '7px 10px',
            fontSize: 12,
            color: '#f3f4f6',
            outline: 'none',
            fontFamily: 'system-ui, sans-serif',
            transition: 'border-color 150ms',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.6)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
          }}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!draft.trim()}
          style={{
            background: draft.trim()
              ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
              : 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: 8,
            padding: '7px 12px',
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 150ms, opacity 150ms',
            opacity: draft.trim() ? 1 : 0.5,
            flexShrink: 0,
          }}
          aria-label="Send message"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
      </div>
    </SectionCard>
  )
}

// ─── Voice channel section ────────────────────────────────────────────────────

const VoiceSection: React.FC = () => {
  const [joined, setJoined] = useState(false)

  return (
    <SectionCard
      title="Voice Channel"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      }
    >
      <div style={{ textAlign: 'center', paddingBottom: 4 }}>
        {joined ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 4,
                marginBottom: 12,
                alignItems: 'flex-end',
                height: 24,
              }}
            >
              {[3, 6, 4, 8, 5, 7, 3].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: h * 2,
                    borderRadius: 2,
                    background: 'linear-gradient(180deg, #7c3aed, #4f46e5)',
                    animation: `lc-pulse ${0.8 + i * 0.15}s ease-in-out infinite`,
                  }}
                />
              ))}
            </div>
            <p
              style={{
                fontSize: 12,
                color: '#22c55e',
                marginBottom: 10,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Connected to general
            </p>
          </div>
        ) : (
          <p
            style={{
              fontSize: 12,
              color: '#9ca3af',
              marginBottom: 12,
              fontFamily: 'system-ui, sans-serif',
              lineHeight: 1.5,
            }}
          >
            Join a voice channel to talk with others solving the same problem.
          </p>
        )}
        <button
          type="button"
          onClick={() => setJoined((v) => !v)}
          style={{
            width: '100%',
            padding: '8px 0',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            background: joined
              ? 'rgba(239, 68, 68, 0.2)'
              : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            color: joined ? '#fca5a5' : '#fff',
            transition: 'all 200ms ease',
          }}
        >
          {joined ? 'Leave Channel' : 'Join Voice Channel'}
        </button>
      </div>
    </SectionCard>
  )
}

// ─── Chevron icon ─────────────────────────────────────────────────────────────

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    className={`lc-chevron${open ? ' open' : ''}`}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      display: 'block',
      transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)',
    }}
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

// ─── Main SlidingPanel component ──────────────────────────────────────────────

export const SlidingPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  // Close panel on Escape key
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }
    document.addEventListener('keyup', handleKeyUp)
    return () => document.removeEventListener('keyup', handleKeyUp)
  }, [isOpen])

  const PANEL_WIDTH = 320
  const TAB_WIDTH = 48
  const TAB_HEIGHT = 80

  return (
    /*
     * Outer wrapper: the entire unit (tab handle + panel) translates together.
     * When closed: translateX(PANEL_WIDTH) so only the tab peeks out (tab is
     * positioned to the LEFT of the panel, outside its bounds).
     * When open: translateX(0) — full panel flush against right edge.
     */
    <div
      className="lc-panel-wrapper"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        width: PANEL_WIDTH,
        zIndex: 2147483647,
        pointerEvents: 'none',
        transform: isOpen ? 'translateX(0)' : `translateX(${PANEL_WIDTH}px)`,
        transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ── Tab handle (sits to the left of the panel, always peeking out) ── */}
      <button
        type="button"
        onClick={toggle}
        className="lc-tab-handle"
        aria-label={isOpen ? 'Close LeetConnect panel' : 'Open LeetConnect panel'}
        aria-expanded={isOpen}
        style={{
          position: 'absolute',
          left: -TAB_WIDTH,
          top: '50%',
          transform: 'translateY(-50%)',
          width: TAB_WIDTH,
          height: TAB_HEIGHT,
          borderRadius: '12px 0 0 12px',
          background: 'linear-gradient(160deg, #7c3aed 0%, #4f46e5 100%)',
          boxShadow: '0 4px 24px rgba(124, 58, 237, 0.4)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          padding: 0,
          outline: 'none',
          // Focus ring for accessibility
          WebkitTapHighlightColor: 'transparent',
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid rgba(167, 139, 250, 0.8)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
      >
        <ChevronIcon open={isOpen} />
      </button>

      {/* ── Panel body ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: '#1a1a2e',
          borderRadius: '16px 0 0 16px',
          boxShadow: '-8px 0 40px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(79,70,229,0.2) 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          {/* Logo mark */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 800,
              color: '#fff',
              fontFamily: 'system-ui, sans-serif',
              boxShadow: '0 2px 12px rgba(124, 58, 237, 0.5)',
              flexShrink: 0,
              letterSpacing: '-0.03em',
            }}
          >
            LC
          </div>
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#f3f4f6',
                fontFamily: 'system-ui, sans-serif',
                lineHeight: 1.2,
              }}
            >
              LeetConnect
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#9ca3af',
                fontFamily: 'system-ui, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                marginTop: 2,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  animation: 'lc-pulse 2s ease-in-out infinite',
                }}
              />
              {MOCK_USERS.length} online
            </div>
          </div>
          {/* Close button */}
          <button
            type="button"
            onClick={toggle}
            aria-label="Close panel"
            style={{
              marginLeft: 'auto',
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.13)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content area */}
        <div
          className="lc-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '14px 14px 8px',
          }}
        >
          <OnlineSection />
          <ChatSection />
          <VoiceSection />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 18px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: '#4b5563',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            v0.1.0
          </span>
          <span
            style={{
              fontSize: 10,
              color: '#4b5563',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            LeetConnect
          </span>
        </div>
      </div>
    </div>
  )
}
