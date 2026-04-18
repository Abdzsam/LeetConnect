import { Server } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { verifyAccessToken } from '../lib/tokens.js'
import { db } from '../db/index.js'
import { problemMessages, users } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'

const ROOM_CAPACITY = 15

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocketUser {
  id: string
  name: string
  avatarUrl: string | null
}

interface RoomPresence {
  socketId: string
  user: SocketUser
}

export interface SubRoomInfo {
  number: number
  userCount: number
  capacity: number
}

// ─── In-memory presence store: roomId → (socketId → presence) ────────────────

const rooms = new Map<string, Map<string, RoomPresence>>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoomUsers(roomId: string): SocketUser[] {
  const room = rooms.get(roomId)
  if (!room) return []
  const seen = new Set<string>()
  const out: SocketUser[] = []
  for (const { user } of room.values()) {
    if (!seen.has(user.id)) {
      seen.add(user.id)
      out.push(user)
    }
  }
  return out
}

function removeSocket(socketId: string, roomId: string): { userGone: boolean; userId: string } {
  const room = rooms.get(roomId)
  if (!room) return { userGone: true, userId: '' }
  const presence = room.get(socketId)
  const userId = presence?.user.id ?? ''
  room.delete(socketId)
  if (room.size === 0) rooms.delete(roomId)
  const userStillPresent = [...(rooms.get(roomId)?.values() ?? [])].some((p) => p.user.id === userId)
  return { userGone: !userStillPresent, userId }
}

function subRoomId(slug: string, n: number): string {
  return `problem:${slug}:${n}`
}

function getProblemSubRooms(slug: string): SubRoomInfo[] {
  const prefix = `problem:${slug}:`
  const result: SubRoomInfo[] = []
  for (const [roomId] of rooms.entries()) {
    if (roomId.startsWith(prefix)) {
      const number = parseInt(roomId.split(':')[2] ?? '0', 10)
      result.push({ number, userCount: getRoomUsers(roomId).length, capacity: ROOM_CAPACITY })
    }
  }
  return result.sort((a, b) => a.number - b.number)
}

function autoAssignRoom(slug: string): number {
  const subRooms = getProblemSubRooms(slug)
  for (const { number, userCount } of subRooms) {
    if (userCount < ROOM_CAPACITY) return number
  }
  return (subRooms[subRooms.length - 1]?.number ?? 0) + 1
}

// ─── Socket.io server factory ─────────────────────────────────────────────────

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (
          !origin ||
          /^chrome-extension:\/\//.test(origin) ||
          /^http:\/\/localhost(:\d+)?$/.test(origin) ||
          /^https?:\/\/leetcode\.com$/.test(origin)
        ) {
          cb(null, true)
        } else {
          cb(new Error('Socket origin not allowed'), false)
        }
      },
      credentials: true,
    },
  })

  // ── JWT auth middleware ──────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth['token']
      if (typeof token !== 'string') { next(new Error('No token')); return }
      const payload = await verifyAccessToken(token)
      const [user] = await db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1)
      if (!user) { next(new Error('User not found')); return }
      socket.data['user'] = user
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  // ── Connection handler ───────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const user = socket.data['user'] as SocketUser
    let currentRoomId: string | null = null   // e.g. "problem:two-sum:1"
    let currentSlug: string | null = null     // e.g. "two-sum"

    // ── join_room ──────────────────────────────────────────────────────────────
    socket.on('join_room', async ({ problemSlug, roomNumber }: { problemSlug?: unknown; roomNumber?: unknown }) => {
      if (typeof problemSlug !== 'string' || !/^[a-z0-9-]+$/i.test(problemSlug)) return
      const slug = problemSlug.toLowerCase()

      // Leave previous sub-room
      if (currentRoomId && currentSlug) {
        const { userGone, userId } = removeSocket(socket.id, currentRoomId)
        if (userGone) socket.to(currentRoomId).emit('user_left', { id: userId })
        socket.leave(currentRoomId)
        io.to(`problem:${currentSlug}`).emit('rooms_updated', getProblemSubRooms(currentSlug))
      }

      // Determine target room number
      const targetNumber =
        typeof roomNumber === 'number' && Number.isInteger(roomNumber) && roomNumber >= 1
          ? roomNumber
          : autoAssignRoom(slug)

      // Reject manual join if room is full
      if (typeof roomNumber === 'number') {
        const count = getRoomUsers(subRoomId(slug, targetNumber)).length
        if (count >= ROOM_CAPACITY) {
          socket.emit('room_full', { roomNumber: targetNumber })
          return
        }
      }

      const roomId = subRoomId(slug, targetNumber)
      currentRoomId = roomId
      currentSlug = slug

      await socket.join(roomId)
      await socket.join(`problem:${slug}`)  // problem-level channel for rooms_updated broadcasts

      if (!rooms.has(roomId)) rooms.set(roomId, new Map())
      rooms.get(roomId)!.set(socket.id, { socketId: socket.id, user })

      // Fetch last 50 messages for this sub-room
      const recent = await db
        .select({
          id: problemMessages.id,
          content: problemMessages.content,
          createdAt: problemMessages.createdAt,
          authorId: users.id,
          authorName: users.name,
          authorAvatarUrl: users.avatarUrl,
        })
        .from(problemMessages)
        .leftJoin(users, eq(problemMessages.userId, users.id))
        .where(eq(problemMessages.roomId, roomId))
        .orderBy(desc(problemMessages.createdAt))
        .limit(50)

      socket.emit('room_state', {
        users: getRoomUsers(roomId),
        messages: recent.reverse().map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt,
          author: { id: m.authorId, name: m.authorName, avatarUrl: m.authorAvatarUrl },
        })),
        roomNumber: targetNumber,
        rooms: getProblemSubRooms(slug),
      })

      socket.to(roomId).emit('user_joined', { id: user.id, name: user.name, avatarUrl: user.avatarUrl })
      io.to(`problem:${slug}`).emit('rooms_updated', getProblemSubRooms(slug))
    })

    // ── send_message ───────────────────────────────────────────────────────────
    socket.on('send_message', async ({ content }: { content?: unknown }) => {
      if (!currentRoomId || typeof content !== 'string') return
      const trimmed = content.trim().slice(0, 500)
      if (!trimmed) return

      const [msg] = await db
        .insert(problemMessages)
        .values({ roomId: currentRoomId, userId: user.id, content: trimmed })
        .returning()

      if (!msg) return
      io.to(currentRoomId).emit('new_message', {
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        author: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
      })
    })

    // ── disconnect ─────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (currentRoomId && currentSlug) {
        const { userGone, userId } = removeSocket(socket.id, currentRoomId)
        if (userGone) socket.to(currentRoomId).emit('user_left', { id: userId })
        io.to(`problem:${currentSlug}`).emit('rooms_updated', getProblemSubRooms(currentSlug))
      }
    })
  })

  return io
}
