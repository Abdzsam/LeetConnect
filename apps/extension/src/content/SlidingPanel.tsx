import React, { useState, useCallback, useRef, useEffect } from 'react'
import { AuthGate } from './AuthGate'
import { useAuth } from '../hooks/useAuth'
import { useProblemRoom, type RoomUser, type RoomMessage, type SubRoomInfo, type VoiceUser } from '../hooks/useProblemRoom'
import { ProfileEditor } from './ProfileEditor'
import { UserProfileCard } from './UserProfileCard'

// ─── LeetCode design tokens ───────────────────────────────────────────────────

const LC = {
  bg:        '#1a1a1a',
  surface:   '#282828',
  surfaceHi: '#333333',
  border:    'rgba(255,255,255,0.08)',
  borderSub: 'rgba(255,255,255,0.05)',
  orange:    '#ffa116',
  orangeDim: 'rgba(255,161,22,0.15)',
  teal:      '#00b8a3',
  tealDim:   'rgba(0,184,163,0.15)',
  red:       '#ef4743',
  redDim:    'rgba(239,71,67,0.15)',
  text:      '#eff1f6',
  textSub:   '#9ca3af',
  textMuted: '#6b7280',
  font:      'system-ui, -apple-system, sans-serif',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Avatar ───────────────────────────────────────────────────────────────────

const Avatar: React.FC<{ name: string | null; url?: string | null; size?: number }> = ({ name, url, size = 30 }) => (
  <div style={{
    width: size, height: size,
    borderRadius: '50%',
    background: url ? 'transparent' : LC.orangeDim,
    border: `2px solid ${url ? 'transparent' : LC.orange}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: Math.floor(size * 0.36),
    fontWeight: 700,
    color: LC.orange,
    flexShrink: 0,
    fontFamily: LC.font,
    overflow: 'hidden',
  }}>
    {url
      ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : initials(name)
    }
  </div>
)

// ─── Section ──────────────────────────────────────────────────────────────────

const Section: React.FC<{
  title: string
  badge?: number
  children: React.ReactNode
}> = ({ title, badge, children }) => (
  <div style={{
    background: LC.surface,
    border: `1px solid ${LC.border}`,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px',
      borderBottom: `1px solid ${LC.borderSub}`,
    }}>
      <span style={{
        fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
        color: LC.textSub, textTransform: 'uppercase',
        fontFamily: LC.font, flex: 1,
      }}>{title}</span>
      {badge !== undefined && (
        <span style={{
          background: LC.orangeDim,
          color: LC.orange,
          fontSize: 11, fontWeight: 700,
          padding: '2px 7px',
          borderRadius: 20,
          fontFamily: LC.font,
        }}>{badge}</span>
      )}
    </div>
    <div style={{ padding: '12px 14px' }}>{children}</div>
  </div>
)

// ─── No problem placeholder ───────────────────────────────────────────────────

const NoProblemPlaceholder: React.FC = () => (
  <div style={{
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    flex: 1, padding: '48px 24px',
    textAlign: 'center', gap: 10,
  }}>
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={LC.textMuted} strokeWidth="1.5" strokeLinecap="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
    <p style={{ fontSize: 13, color: LC.textSub, fontFamily: LC.font, margin: 0, lineHeight: 1.6 }}>
      Open a LeetCode problem to see who else is solving it.
    </p>
  </div>
)

// ─── Online section ───────────────────────────────────────────────────────────

const OnlineSection: React.FC<{
  users: RoomUser[]
  currentUserId: string
  currentRoomNumber: number | null
  availableRooms: SubRoomInfo[]
  onJoinRoom: (n: number) => void
  onUserClick: (user: RoomUser) => void
}> = ({ users, currentUserId, currentRoomNumber, availableRooms, onJoinRoom, onUserClick }) => {
  const [showRooms, setShowRooms] = useState(false)

  return (
    <Section title={currentRoomNumber !== null ? `Room ${currentRoomNumber}` : 'Online'} badge={users.length}>
      {availableRooms.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setShowRooms((v) => !v)}
            style={{
              background: 'transparent',
              border: `1px solid ${LC.border}`,
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11,
              color: LC.textSub,
              cursor: 'pointer',
              fontFamily: LC.font,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            {showRooms ? 'Hide rooms' : 'Switch room'}
          </button>

          {showRooms && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: isCurrent ? LC.orangeDim : 'transparent',
                      border: `1px solid ${isCurrent ? LC.orange : LC.border}`,
                      borderRadius: 8,
                      padding: '6px 10px',
                      cursor: isCurrent || isFull ? 'default' : 'pointer',
                      opacity: isFull && !isCurrent ? 0.45 : 1,
                    }}
                  >
                    <span style={{ fontSize: 12, color: isCurrent ? LC.orange : LC.text, fontFamily: LC.font, fontWeight: isCurrent ? 600 : 400 }}>
                      Room {room.number}{isCurrent ? ' (you)' : ''}
                    </span>
                    <span style={{ fontSize: 11, color: LC.textSub, fontFamily: LC.font }}>
                      {room.userCount}/{room.capacity}{isFull ? ' · full' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {users.length === 0 ? (
        <p style={{ fontSize: 12, color: LC.textSub, fontFamily: LC.font, margin: 0 }}>
          No one else here yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {users.map((user) => {
            const isMe = user.id === currentUserId
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => { if (!isMe) onUserClick(user) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: 8,
                  padding: '5px 6px',
                  cursor: isMe ? 'default' : 'pointer',
                  textAlign: 'left', width: '100%',
                  transition: 'background 150ms, border-color 150ms',
                }}
                onMouseEnter={(e) => { if (!isMe) { e.currentTarget.style.background = LC.surfaceHi; e.currentTarget.style.borderColor = LC.border } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
              >
                <Avatar name={user.name} url={user.avatarUrl} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6,
                    borderRadius: '50%', background: LC.teal, flexShrink: 0,
                    animation: 'lc-pulse 2s ease-in-out infinite',
                  }} />
                  <span style={{
                    fontSize: 13, fontWeight: 400,
                    color: isMe ? LC.orange : LC.text,
                    fontFamily: LC.font,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user.name}{isMe ? ' (you)' : ''}
                  </span>
                </div>
                {!isMe && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={LC.textMuted} strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// ─── Chat section ─────────────────────────────────────────────────────────────

const ChatSection: React.FC<{
  messages: RoomMessage[]
  messagesLoading: boolean
  onSend: (content: string) => void
  currentUserId: string
  onUserClick: (user: RoomUser) => void
}> = ({ messages, messagesLoading, onSend, currentUserId, onUserClick }) => {
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }, [send])

  return (
    <Section title="Chat">
      <div
        className="lc-scrollbar"
        style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 10 }}
      >
        {messagesLoading ? (
          <p style={{ fontSize: 12, color: LC.textSub, fontFamily: LC.font, margin: 0 }}>Loading messages…</p>
        ) : messages.length === 0 ? (
          <p style={{ fontSize: 12, color: LC.textSub, fontFamily: LC.font, margin: 0 }}>No messages yet. Say hi!</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.author.id === currentUserId
            const handleAuthorClick = () => { if (!isMe) onUserClick(msg.author as RoomUser) }
            return (
              <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <button type="button" onClick={handleAuthorClick} disabled={isMe}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: isMe ? 'default' : 'pointer', flexShrink: 0 }}>
                  <Avatar name={msg.author.name} url={msg.author.avatarUrl} size={24} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                    <button type="button" onClick={handleAuthorClick} disabled={isMe}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: isMe ? 'default' : 'pointer' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isMe ? LC.orange : LC.text, fontFamily: LC.font }}>
                        {isMe ? 'You' : (msg.author.name ?? 'Unknown')}
                      </span>
                    </button>
                    <span style={{ fontSize: 10, color: LC.textMuted, fontFamily: LC.font }}>
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: LC.textSub, margin: 0, lineHeight: 1.5, wordBreak: 'break-word', fontFamily: LC.font }}>
                    {msg.content}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          maxLength={500}
          style={{
            flex: 1,
            background: LC.surfaceHi,
            border: `1px solid ${LC.border}`,
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 13,
            color: LC.text,
            outline: 'none',
            fontFamily: LC.font,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = LC.orange }}
          onBlur={(e) => { e.currentTarget.style.borderColor = LC.border }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim()}
          style={{
            background: draft.trim() ? LC.orange : LC.surfaceHi,
            border: 'none',
            borderRadius: 10,
            padding: '8px 12px',
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: draft.trim() ? 1 : 0.4,
            flexShrink: 0,
          }}
          aria-label="Send"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={draft.trim() ? '#1a1a1a' : LC.textSub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </Section>
  )
}

// ─── Voice avatar ─────────────────────────────────────────────────────────────

const VoiceAvatar: React.FC<{
  user: RoomUser
  speaking: boolean
  isLocal: boolean
  muted?: boolean
  onClick?: () => void
}> = ({ user, speaking, isLocal, muted, onClick }) => (
  <button type="button" onClick={onClick} disabled={isLocal}
    style={{ background: 'none', border: 'none', padding: 0, cursor: isLocal ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 58 }}>
    <div style={{
      position: 'relative',
      width: 48, height: 48,
    }}>
      {/* Speaking ring */}
      <div style={{
        position: 'absolute', inset: -3,
        borderRadius: '50%',
        border: `3px solid ${speaking ? LC.orange : 'transparent'}`,
        boxShadow: speaking ? `0 0 12px rgba(255,161,22,0.55)` : 'none',
        transition: 'border-color 120ms, box-shadow 120ms',
        pointerEvents: 'none',
      }} />
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: user.avatarUrl ? 'transparent' : LC.orangeDim,
        border: `2px solid ${speaking ? LC.orange : LC.border}`,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: LC.orange,
        transition: 'border-color 120ms',
      }}>
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials(user.name)
        }
      </div>
      {/* Muted badge */}
      {isLocal && muted && (
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 16, height: 16, borderRadius: '50%',
          background: LC.red,
          border: `2px solid ${LC.surface}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
          </svg>
        </div>
      )}
    </div>
    <span style={{
      fontSize: 11, color: isLocal ? LC.orange : LC.textSub,
      fontFamily: LC.font, textAlign: 'center',
      overflow: 'hidden', textOverflow: 'ellipsis',
      whiteSpace: 'nowrap', maxWidth: '100%', lineHeight: 1.2,
    }}>
      {isLocal ? 'You' : (user.name?.split(' ')[0] ?? '?')}
    </span>
  </button>
)

// ─── Voice section ────────────────────────────────────────────────────────────

const VoiceSection: React.FC<{
  joined: boolean
  connecting: boolean
  muted: boolean
  participants: VoiceUser[]
  speakingSocketIds: Set<string>
  localSocketId: string | null
  error: string | null
  onJoin: () => void
  onLeave: () => void
  onToggleMute: () => void
  onUserClick: (user: RoomUser) => void
}> = ({ joined, connecting, muted, participants, speakingSocketIds, localSocketId, error, onJoin, onLeave, onToggleMute, onUserClick }) => (
  <Section title="Voice" badge={participants.length > 0 ? participants.length : undefined}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Participant avatars */}
      {participants.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {participants.map(({ socketId, user }) => (
            <VoiceAvatar
              key={socketId}
              user={user}
              speaking={speakingSocketIds.has(socketId)}
              isLocal={socketId === localSocketId}
              muted={socketId === localSocketId ? muted : undefined}
              onClick={() => { if (socketId !== localSocketId) onUserClick(user) }}
            />
          ))}
        </div>
      )}

      {!joined && participants.length === 0 && (
        <p style={{ fontSize: 12, color: LC.textSub, fontFamily: LC.font, margin: 0 }}>
          No one in voice yet.
        </p>
      )}

      {error && (
        <div style={{
          background: LC.redDim,
          border: `1px solid ${LC.red}`,
          borderRadius: 8, padding: '8px 10px',
          fontSize: 12, color: '#ff6b6b',
          fontFamily: LC.font, lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={joined ? onLeave : onJoin}
          disabled={connecting}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 10,
            border: joined ? `1px solid ${LC.red}` : 'none',
            cursor: connecting ? 'wait' : 'pointer',
            fontSize: 13, fontWeight: 600,
            fontFamily: LC.font,
            background: joined ? LC.redDim : LC.orange,
            color: joined ? '#ff6b6b' : '#1a1a1a',
            opacity: connecting ? 0.6 : 1,
          }}
        >
          {connecting ? 'Joining…' : joined ? 'Leave Voice' : 'Join Voice'}
        </button>
        {joined && (
          <button
            type="button"
            onClick={onToggleMute}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${LC.border}`,
              cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              fontFamily: LC.font,
              background: muted ? LC.orangeDim : LC.surfaceHi,
              color: muted ? LC.orange : LC.textSub,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {muted ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
              </svg>
            )}
            {muted ? 'Unmute' : 'Mute'}
          </button>
        )}
      </div>
    </div>
  </Section>
)

// ─── Problem room content ─────────────────────────────────────────────────────

const ProblemRoomContent: React.FC = () => {
  const { state } = useAuth()
  const {
    roomUsers, messages, messagesLoading, connected, problemSlug,
    currentRoomNumber, availableRooms, sendMessage, joinRoom,
    voiceParticipants, voiceJoined, voiceConnecting, voiceMuted,
    voiceError, joinVoice, leaveVoice, toggleMute,
    speakingSocketIds, localSocketId,
  } = useProblemRoom()

  const [selectedUser, setSelectedUser] = useState<RoomUser | null>(null)

  if (state.status !== 'authenticated') return null
  if (!problemSlug) return <NoProblemPlaceholder />

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {!connected && (
        <div style={{
          background: LC.redDim,
          border: `1px solid ${LC.red}`,
          borderRadius: 8,
          padding: '7px 12px',
          marginBottom: 10,
          fontSize: 12, color: '#ff6b6b',
          fontFamily: LC.font,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: LC.red, flexShrink: 0 }} />
          Connecting…
        </div>
      )}
      <OnlineSection
        users={roomUsers}
        currentUserId={state.user.id}
        currentRoomNumber={currentRoomNumber}
        availableRooms={availableRooms}
        onJoinRoom={joinRoom}
        onUserClick={setSelectedUser}
      />
      <ChatSection
        messages={messages}
        messagesLoading={messagesLoading}
        onSend={sendMessage}
        currentUserId={state.user.id}
        onUserClick={setSelectedUser}
      />
      <VoiceSection
        joined={voiceJoined}
        connecting={voiceConnecting}
        muted={voiceMuted}
        participants={voiceParticipants}
        speakingSocketIds={speakingSocketIds}
        localSocketId={localSocketId}
        error={voiceError}
        onJoin={joinVoice}
        onLeave={leaveVoice}
        onToggleMute={toggleMute}
        onUserClick={setSelectedUser}
      />

      {selectedUser && (
        <UserProfileCard
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  )
}

// ─── Sliding panel ────────────────────────────────────────────────────────────

export const SlidingPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const { state, signOut } = useAuth()
  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) setIsOpen(false) }
    document.addEventListener('keyup', onKey)
    return () => document.removeEventListener('keyup', onKey)
  }, [isOpen])

  const PANEL_WIDTH = 320
  const TAB_WIDTH = 38

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0,
      height: '100vh', width: PANEL_WIDTH,
      zIndex: 2147483647, pointerEvents: 'none',
      transform: isOpen ? 'translateX(0)' : `translateX(${PANEL_WIDTH}px)`,
      transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* Tab */}
      <button
        type="button"
        onClick={toggle}
        aria-label={isOpen ? 'Close LeetConnect' : 'Open LeetConnect'}
        aria-expanded={isOpen}
        style={{
          position: 'absolute',
          left: -TAB_WIDTH, top: '50%',
          transform: 'translateY(-50%)',
          width: TAB_WIDTH, height: 80,
          borderRadius: '10px 0 0 10px',
          background: LC.orange,
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto', padding: 0,
          outline: 'none',
          boxShadow: '-3px 0 16px rgba(0,0,0,0.5)',
        }}
        onFocus={(e) => { e.currentTarget.style.outline = `2px solid ${LC.orange}`; e.currentTarget.style.outlineOffset = '2px' }}
        onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 300ms' }}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Panel body */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        background: LC.bg,
        borderLeft: `1px solid rgba(255,255,255,0.06)`,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', pointerEvents: 'auto',
      }}>
        {/* Header */}
        <div style={{
          background: LC.surface,
          borderBottom: `1px solid ${LC.border}`,
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 9,
            background: `linear-gradient(135deg, ${LC.orange} 0%, #ff8c00 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800,
            color: '#1a1a1a',
            fontFamily: LC.font,
            flexShrink: 0,
            letterSpacing: '-0.03em',
          }}>LC</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: LC.text, fontFamily: LC.font, lineHeight: 1.2 }}>
              LeetConnect
            </div>
            <div style={{ fontSize: 11, color: LC.textSub, fontFamily: LC.font, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {state.status === 'authenticated' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: LC.teal, flexShrink: 0 }} />
                  {state.user.name}
                </span>
              ) : 'Sign in to connect'}
            </div>
          </div>

          {state.status === 'authenticated' && (
            <button
              type="button"
              onClick={() => setShowProfile((v) => !v)}
              aria-label="Edit profile"
              title="Edit socials"
              style={{
                width: 28, height: 28,
                borderRadius: 8,
                background: showProfile ? LC.orangeDim : 'transparent',
                border: `1px solid ${showProfile ? LC.orange : LC.border}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 150ms, border-color 150ms',
              }}
              onMouseEnter={(e) => { if (!showProfile) { e.currentTarget.style.background = LC.surfaceHi } }}
              onMouseLeave={(e) => { if (!showProfile) { e.currentTarget.style.background = 'transparent' } }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showProfile ? LC.orange : LC.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </button>
          )}

          {state.status === 'authenticated' && (
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              style={{
                width: 28, height: 28,
                borderRadius: 8,
                background: 'transparent',
                border: `1px solid ${LC.border}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 150ms, border-color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = LC.red; e.currentTarget.style.background = LC.redDim }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = LC.border; e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={LC.textSub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            style={{
              width: 28, height: 28,
              borderRadius: 8,
              background: 'transparent',
              border: `1px solid ${LC.border}`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = LC.surfaceHi }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={LC.textSub} strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {showProfile && state.status === 'authenticated' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ProfileEditor onBack={() => setShowProfile(false)} />
          </div>
        ) : (
          <div className="lc-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 10px 6px', display: 'flex', flexDirection: 'column' }}>
            <AuthGate>
              <ProblemRoomContent />
            </AuthGate>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '6px 14px', borderTop: `1px solid ${LC.borderSub}`, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: LC.textMuted, fontFamily: LC.font }}>v0.1.0</span>
          <span style={{ fontSize: 10, color: LC.textMuted, fontFamily: LC.font }}>LeetConnect</span>
        </div>
      </div>
    </div>
  )
}
