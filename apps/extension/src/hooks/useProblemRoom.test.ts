/**
 * useProblemRoom tests
 *
 * We mock socket.io-client so no real network connections are made.
 * WebRTC (RTCPeerConnection, getUserMedia) is not available in jsdom;
 * those paths are either skipped or tested at the emit level only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Socket.io mock ───────────────────────────────────────────────────────────

// Build a minimal mock socket that stores event listeners and lets us fire them.
type Listener = (...args: unknown[]) => void

function createMockSocket() {
  const listeners: Record<string, Listener[]> = {}
  const emitted: Array<[string, unknown]> = []

  const socket = {
    id: 'mock-socket-id',
    connected: false,
    on(event: string, fn: Listener) {
      if (!listeners[event]) listeners[event] = []
      listeners[event]!.push(fn)
      return socket
    },
    emit(event: string, data?: unknown) {
      emitted.push([event, data])
      return socket
    },
    disconnect() {
      socket.connected = false
    },
    // Test helpers — not part of the real socket API
    _fire(event: string, ...args: unknown[]) {
      for (const fn of listeners[event] ?? []) fn(...args)
    },
    _emitted: emitted,
    _listeners: listeners,
  }
  return socket
}

type MockSocket = ReturnType<typeof createMockSocket>
let mockSocket: MockSocket

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

// ─── Chrome storage stub (returns token so socket connect is attempted) ───────

;(globalThis as unknown as Record<string, unknown>)['chrome'] ??= {}
const chromeMock = (globalThis as unknown as { chrome: Record<string, unknown> }).chrome
chromeMock['storage'] ??= {}
;(chromeMock['storage'] as Record<string, unknown>)['local'] = {
  get: vi.fn((_key: unknown, cb: (r: Record<string, unknown>) => void) => {
    cb({ accessToken: 'test-token' })
  }),
}

// ─── Setup ────────────────────────────────────────────────────────────────────

// Import after mocks are in place
const { useProblemRoom } = await import('./useProblemRoom.js')

function renderRoom() {
  return renderHook(() => useProblemRoom())
}

beforeEach(() => {
  mockSocket = createMockSocket()
  vi.clearAllMocks()
  // Reset window.location to a non-problem page
  Object.defineProperty(window, 'location', {
    value: { pathname: '/problems/two-sum/', search: '', hash: '' },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Slug detection ───────────────────────────────────────────────────────────

describe('getProblemSlug (currentProblemSlug detection)', () => {
  it('extracts the slug from a standard LeetCode problem URL', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/problems/two-sum/' },
      writable: true,
      configurable: true,
    })
    const { result } = renderRoom()
    expect(result.current.problemSlug).toBe('two-sum')
  })

  it('returns null for the homepage', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
      configurable: true,
    })
    const { result } = renderRoom()
    expect(result.current.problemSlug).toBeNull()
  })

  it('returns null for a non-problem LeetCode page', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/contest/weekly-contest-1/' },
      writable: true,
      configurable: true,
    })
    const { result } = renderRoom()
    expect(result.current.problemSlug).toBeNull()
  })

  it('normalises the slug to lowercase', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/problems/Two-Sum/' },
      writable: true,
      configurable: true,
    })
    const { result } = renderRoom()
    // getProblemSlug calls .toLowerCase()
    expect(result.current.problemSlug).toBe('two-sum')
  })
})

// ─── sendMessage ──────────────────────────────────────────────────────────────

describe('sendMessage', () => {
  it('emits send_message with the provided content', async () => {
    const { result } = renderRoom()

    // Wait for the socket to be connected by simulating the connect event
    await act(async () => {
      mockSocket.connected = true
      mockSocket._fire('connect')
    })

    act(() => {
      result.current.sendMessage('hello world')
    })

    const found = mockSocket._emitted.find(([e]) => e === 'send_message')
    expect(found).toBeDefined()
    expect(found?.[1]).toEqual({ content: 'hello world' })
  })
})

// ─── joinRoom ─────────────────────────────────────────────────────────────────

describe('joinRoom', () => {
  it('emits join_room with the correct slug and roomNumber', async () => {
    const { result } = renderRoom()

    await act(async () => {
      mockSocket.connected = true
      mockSocket._fire('connect')
    })

    act(() => {
      result.current.joinRoom(2)
    })

    const found = mockSocket._emitted.find(([e]) => e === 'join_room')
    expect(found).toBeDefined()
    expect((found?.[1] as Record<string, unknown>)['roomNumber']).toBe(2)
    expect((found?.[1] as Record<string, unknown>)['problemSlug']).toBe('two-sum')
  })
})

// ─── Socket event: room_state ─────────────────────────────────────────────────

describe('room_state event', () => {
  it('updates roomUsers, messages, and currentRoomNumber', async () => {
    const { result } = renderRoom()

    await act(async () => {
      mockSocket.connected = true
      mockSocket._fire('connect')
    })

    const payload = {
      users: [{ id: 'u1', name: 'Alice', avatarUrl: null }],
      messages: [
        {
          id: 'm1',
          content: 'hi',
          createdAt: new Date().toISOString(),
          author: { id: 'u1', name: 'Alice', avatarUrl: null },
        },
      ],
      roomNumber: 1,
      rooms: [{ number: 1, userCount: 1, capacity: 15 }],
      voiceUsers: [],
    }

    await act(async () => {
      mockSocket._fire('room_state', payload)
    })

    expect(result.current.roomUsers).toHaveLength(1)
    expect(result.current.roomUsers[0]?.name).toBe('Alice')
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.currentRoomNumber).toBe(1)
    expect(result.current.messagesLoading).toBe(false)
  })
})

// ─── Socket event: user_joined ────────────────────────────────────────────────

describe('user_joined event', () => {
  it('appends a new user to roomUsers', async () => {
    const { result } = renderRoom()

    await act(async () => {
      mockSocket.connected = true
      mockSocket._fire('connect')
      mockSocket._fire('room_state', {
        users: [],
        messages: [],
        roomNumber: 1,
        rooms: [],
        voiceUsers: [],
      })
    })

    await act(async () => {
      mockSocket._fire('user_joined', { id: 'u2', name: 'Bob', avatarUrl: null })
    })

    expect(result.current.roomUsers.some((u) => u.name === 'Bob')).toBe(true)
  })
})

// ─── Socket event: user_left ──────────────────────────────────────────────────

describe('user_left event', () => {
  it('removes a user from roomUsers', async () => {
    const { result } = renderRoom()

    await act(async () => {
      mockSocket.connected = true
      mockSocket._fire('connect')
      mockSocket._fire('room_state', {
        users: [{ id: 'u1', name: 'Alice', avatarUrl: null }],
        messages: [],
        roomNumber: 1,
        rooms: [],
        voiceUsers: [],
      })
    })

    await act(async () => {
      mockSocket._fire('user_left', { id: 'u1' })
    })

    expect(result.current.roomUsers.find((u) => u.id === 'u1')).toBeUndefined()
  })
})

// ─── Socket event: new_message ────────────────────────────────────────────────

describe('new_message event', () => {
  it('appends a new message to messages', async () => {
    const { result } = renderRoom()

    await act(async () => {
      mockSocket.connected = true
      mockSocket._fire('connect')
      mockSocket._fire('room_state', {
        users: [],
        messages: [],
        roomNumber: 1,
        rooms: [],
        voiceUsers: [],
      })
    })

    const msg = {
      id: 'msg-1',
      content: 'hello',
      createdAt: new Date().toISOString(),
      author: { id: 'u1', name: 'Alice', avatarUrl: null },
    }

    await act(async () => {
      mockSocket._fire('new_message', msg)
    })

    expect(result.current.messages.some((m) => m.id === 'msg-1')).toBe(true)
  })
})

// ─── Socket event: voice_joined / voice_user_joined ───────────────────────────

describe('voice_user_joined event', () => {
  it('adds a participant to voiceParticipants', async () => {
    const { result } = renderRoom()

    await act(async () => {
      mockSocket.connected = true
      mockSocket._fire('connect')
      mockSocket._fire('room_state', {
        users: [],
        messages: [],
        roomNumber: 1,
        rooms: [],
        voiceUsers: [],
      })
    })

    const participant = {
      socketId: 'peer-socket-1',
      user: { id: 'u2', name: 'Bob', avatarUrl: null },
    }

    await act(async () => {
      mockSocket._fire('voice_user_joined', participant)
    })

    expect(result.current.voiceParticipants.some((p) => p.socketId === 'peer-socket-1')).toBe(true)
  })
})

// ─── Socket event: voice_user_left ───────────────────────────────────────────

describe('voice_user_left event', () => {
  it('removes a participant from voiceParticipants', async () => {
    const { result } = renderRoom()

    await act(async () => {
      mockSocket.connected = true
      mockSocket._fire('connect')
      mockSocket._fire('room_state', {
        users: [],
        messages: [],
        roomNumber: 1,
        rooms: [],
        voiceUsers: [{ socketId: 'peer-socket-1', user: { id: 'u2', name: 'Bob', avatarUrl: null } }],
      })
    })

    await act(async () => {
      mockSocket._fire('voice_user_left', { socketId: 'peer-socket-1' })
    })

    expect(result.current.voiceParticipants.find((p) => p.socketId === 'peer-socket-1')).toBeUndefined()
  })
})

// ─── leaveVoice ───────────────────────────────────────────────────────────────

describe('leaveVoice', () => {
  it('emits leave_voice and resets voiceJoined to false', async () => {
    const { result } = renderRoom()

    await act(async () => {
      mockSocket.connected = true
      mockSocket._fire('connect')
    })

    act(() => {
      result.current.leaveVoice()
    })

    const found = mockSocket._emitted.find(([e]) => e === 'leave_voice')
    expect(found).toBeDefined()
    expect(result.current.voiceJoined).toBe(false)
  })
})

// ─── joinVoice (skipped — getUserMedia not available in jsdom) ────────────────

describe.skip('joinVoice (requires getUserMedia)', () => {
  // getUserMedia is not available in jsdom. These tests would need a full
  // browser environment or a manual stub for navigator.mediaDevices.
  it('calls getUserMedia and emits join_voice', () => {})
})

// ─── disconnect state cleanup ─────────────────────────────────────────────────

describe('disconnect event', () => {
  it('sets connected to false after connect then disconnect', async () => {
    const { result } = renderRoom()

    // Allow the async connect() call inside the effect to complete
    await act(async () => {
      await Promise.resolve() // flush getStoredToken microtask
    })

    // Fire connect so the hook sets connected=true
    await act(async () => {
      mockSocket.connected = true
      mockSocket._fire('connect')
    })

    // Now fire disconnect — connected should become false
    await act(async () => {
      mockSocket.connected = false
      mockSocket._fire('disconnect')
    })

    expect(result.current.connected).toBe(false)
  })
})
