import React, { useState, useCallback, useRef, useEffect } from 'react'
import { AuthGate } from './AuthGate'
import { useAuth } from '../hooks/useAuth'
import { useProblemRoom, type RoomUser, type RoomMessage, type SubRoomInfo } from '../hooks/useProblemRoom'

function formatTime(ts: number | string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

const Avatar: React.FC<{ name: string | null; url?: string | null }> = ({ name, url }) => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: url ? 'transparent' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      fontWeight: 700,
      color: '#fff',
      flexShrink: 0,
      fontFamily: 'system-ui, sans-serif',
      letterSpacing: '0.05em',
      overflow: 'hidden',
    }}
  >
    {url ? (
      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      initials(name)
    )}
  </div>
)

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
            background: 'rgba(124,58,237,0.3)',
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
    <div style={{ padding: '10px 14px' }}>{children}</div>
  </div>
)

const NoProblemPlaceholder: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      padding: '40px 24px',
      textAlign: 'center',
      gap: 12,
    }}
  >
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
    <p style={{ fontSize: 13, color: '#6b7280', fontFamily: 'system-ui, sans-serif', margin: 0, lineHeight: 1.6 }}>
      Open a LeetCode problem to see who else is solving it.
    </p>
  </div>
)

const OnlineSection: React.FC<{
  users: RoomUser[]
  currentUserId: string
  currentRoomNumber: number | null
  availableRooms: SubRoomInfo[]
  onJoinRoom: (n: number) => void
}> = ({ users, currentUserId, currentRoomNumber, availableRooms, onJoinRoom }) => {
  const [showRooms, setShowRooms] = useState(false)

  return (
    <SectionCard
      title={currentRoomNumber !== null ? `Room ${currentRoomNumber}` : 'Online Now'}
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      }
      badge={users.length}
    >
      {availableRooms.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setShowRooms((v) => !v)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              color: '#9ca3af',
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            {showRooms ? 'Hide rooms' : 'Switch room'}
          </button>

          {showRooms && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {availableRooms.map((room) => {
                const isCurrent = room.number === currentRoomNumber
                const isFull = room.userCount >= room.capacity
                return (
                  <button
                    key={room.number}
                    type="button"
                    disabled={isCurrent || isFull}
                    onClick={() => { onJoinRoom(room.number); setShowRooms(false) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isCurrent ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isCurrent ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 6,
                      padding: '5px 10px',
                      cursor: isCurrent || isFull ? 'default' : 'pointer',
                      opacity: isFull && !isCurrent ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontSize: 12, color: isCurrent ? '#c4b5fd' : '#d1d5db', fontFamily: 'system-ui, sans-serif', fontWeight: isCurrent ? 600 : 400 }}>
                      Room {room.number}{isCurrent ? ' (you)' : ''}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>
                      {room.userCount}/{room.capacity}{isFull ? ' full' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {users.length === 0 ? (
        <p style={{ fontSize: 12, color: '#6b7280', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
          No one else is here yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {users.map((user) => (
            <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={user.name} url={user.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0, animation: 'lc-pulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: user.id === currentUserId ? '#a78bfa' : '#f3f4f6', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name}{user.id === currentUserId ? ' (you)' : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

const ChatSection: React.FC<{
  messages: RoomMessage[]
  onSend: (content: string) => void
  currentUserId: string
}> = ({ messages, onSend, currentUserId }) => {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }, [draft, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
    },
    [send],
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
      <div
        className="lc-scrollbar"
        style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}
      >
        {messages.length === 0 ? (
          <p style={{ fontSize: 12, color: '#6b7280', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
            No messages yet. Say hi!
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.author.id === currentUserId
            return (
              <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Avatar name={msg.author.name} url={msg.author.avatarUrl} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isMe ? '#c4b5fd' : '#a78bfa',
                        fontFamily: 'system-ui, sans-serif',
                      }}
                    >
                      {isMe ? 'You' : (msg.author.name ?? 'Unknown')}
                    </span>
                    <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
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
                    {msg.content}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

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
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.6)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim()}
          style={{
            background: draft.trim() ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: 8,
            padding: '7px 12px',
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: draft.trim() ? 1 : 0.5,
            flexShrink: 0,
          }}
          aria-label="Send message"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </SectionCard>
  )
}

const VoiceSection: React.FC<{
  joined: boolean
  connecting: boolean
  muted: boolean
  participants: RoomUser[]
  error: string | null
  onJoin: () => void
  onLeave: () => void
  onToggleMute: () => void
}> = ({ joined, connecting, muted, participants, error, onJoin, onLeave, onToggleMute }) => (
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
      <p style={{ fontSize: 11, color: '#a78bfa', marginTop: 0, marginBottom: 8, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {participants.length} {participants.length === 1 ? 'person' : 'people'} in voice
      </p>
      {joined && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 12, alignItems: 'flex-end', height: 24 }}>
          {[3, 6, 4, 8, 5, 7, 3].map((h, i) => (
            <div
              key={i}
              style={{ width: 3, height: h * 2, borderRadius: 2, background: 'linear-gradient(180deg, #7c3aed, #4f46e5)', animation: `lc-pulse ${0.8 + i * 0.15}s ease-in-out infinite` }}
            />
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: joined ? '#22c55e' : '#9ca3af', marginBottom: 12, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
        {joined ? (muted ? 'Connected, microphone muted.' : 'Connected, microphone live.') : 'Join the room voice call for this problem.'}
      </p>
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 12,
            fontSize: 11,
            color: '#fca5a5',
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={joined ? onLeave : onJoin}
        disabled={connecting}
        style={{
          width: '100%',
          padding: '8px 0',
          borderRadius: 8,
          border: 'none',
          cursor: connecting ? 'wait' : 'pointer',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
          background: joined ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          color: joined ? '#fca5a5' : '#fff',
          opacity: connecting ? 0.7 : 1,
          marginBottom: joined ? 8 : 0,
        }}
      >
        {connecting ? 'Joining Voice…' : joined ? 'Leave Channel' : 'Join Voice Channel'}
      </button>
      {joined && (
        <button
          type="button"
          onClick={onToggleMute}
          style={{
            width: '100%',
            padding: '8px 0',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            background: 'rgba(255,255,255,0.06)',
            color: muted ? '#fca5a5' : '#d1d5db',
          }}
        >
          {muted ? 'Unmute Microphone' : 'Mute Microphone'}
        </button>
      )}
    </div>
  </SectionCard>
)

const ProblemRoomContent: React.FC = () => {
  const { state } = useAuth()
  const {
    roomUsers,
    messages,
    connected,
    problemSlug,
    currentRoomNumber,
    availableRooms,
    sendMessage,
    joinRoom,
    voiceParticipants,
    voiceJoined,
    voiceConnecting,
    voiceMuted,
    voiceError,
    joinVoice,
    leaveVoice,
    toggleMute,
  } = useProblemRoom()

  if (state.status !== 'authenticated') return null
  if (!problemSlug) return <NoProblemPlaceholder />

  return (
    <>
      {!connected && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            padding: '6px 12px',
            marginBottom: 10,
            fontSize: 11,
            color: '#fca5a5',
            fontFamily: 'system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
          Connecting to server…
        </div>
      )}

      <OnlineSection
        users={roomUsers}
        currentUserId={state.user.id}
        currentRoomNumber={currentRoomNumber}
        availableRooms={availableRooms}
        onJoinRoom={joinRoom}
      />
      <ChatSection messages={messages} onSend={sendMessage} currentUserId={state.user.id} />
      <VoiceSection
        joined={voiceJoined}
        connecting={voiceConnecting}
        muted={voiceMuted}
        participants={voiceParticipants.map((entry) => entry.user)}
        error={voiceError}
        onJoin={joinVoice}
        onLeave={leaveVoice}
        onToggleMute={toggleMute}
      />
    </>
  )
}

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)' }}
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

export const SlidingPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { state, signOut } = useAuth()

  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) setIsOpen(false) }
    document.addEventListener('keyup', onKey)
    return () => document.removeEventListener('keyup', onKey)
  }, [isOpen])

  const PANEL_WIDTH = 320
  const TAB_WIDTH = 48
  const TAB_HEIGHT = 80

  return (
    <div
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
      <button
        type="button"
        onClick={toggle}
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
          boxShadow: '0 4px 24px rgba(124,58,237,0.4)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          padding: 0,
          outline: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
        onFocus={(e) => { e.currentTarget.style.outline = '2px solid rgba(167,139,250,0.8)'; e.currentTarget.style.outlineOffset = '2px' }}
        onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
      >
        <ChevronIcon open={isOpen} />
      </button>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: '#1a1a2e',
          borderRadius: '16px 0 0 16px',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
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
              boxShadow: '0 2px 12px rgba(124,58,237,0.5)',
              flexShrink: 0,
              letterSpacing: '-0.03em',
            }}
          >
            LC
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f3f4f6', fontFamily: 'system-ui, sans-serif', lineHeight: 1.2 }}>
              LeetConnect
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'system-ui, sans-serif', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {state.status === 'authenticated' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                  {state.user.name}
                </span>
              ) : 'Sign in to connect'}
            </div>
          </div>

          {state.status === 'authenticated' && (
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={toggle}
            aria-label="Close panel"
            style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="lc-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column' }}>
          <AuthGate>
            <ProblemRoomContent />
          </AuthGate>
        </div>

        <div style={{ padding: '8px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'system-ui, sans-serif' }}>v0.1.0</span>
          <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'system-ui, sans-serif' }}>LeetConnect</span>
        </div>
      </div>
    </div>
  )
}
