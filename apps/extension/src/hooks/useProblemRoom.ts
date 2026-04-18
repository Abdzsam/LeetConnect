import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

declare const __SERVER_URL__: string
const SERVER_URL = __SERVER_URL__

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoomUser {
  id: string
  name: string
  avatarUrl: string | null
}

export interface RoomMessage {
  id: string
  content: string
  createdAt: string
  author: {
    id: string | null
    name: string | null
    avatarUrl: string | null
  }
}

export interface SubRoomInfo {
  number: number
  userCount: number
  capacity: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProblemSlug(pathname: string): string | null {
  const match = pathname.match(/^\/problems\/([a-z0-9-]+)/i)
  return match ? match[1].toLowerCase() : null
}

async function getStoredToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('accessToken', (r) => {
      resolve((r['accessToken'] as string | null | undefined) ?? null)
    })
  })
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProblemRoom() {
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([])
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [currentRoomNumber, setCurrentRoomNumber] = useState<number | null>(null)
  const [availableRooms, setAvailableRooms] = useState<SubRoomInfo[]>([])
  const [problemSlug, setProblemSlug] = useState<string | null>(() =>
    getProblemSlug(window.location.pathname),
  )

  const socketRef = useRef<Socket | null>(null)
  const slugRef = useRef(problemSlug)

  // Detect LeetCode SPA navigations
  useEffect(() => {
    const check = () => {
      const newSlug = getProblemSlug(window.location.pathname)
      if (newSlug !== slugRef.current) {
        slugRef.current = newSlug
        setProblemSlug(newSlug)
        setCurrentRoomNumber(null)
        setAvailableRooms([])
        if (newSlug && socketRef.current?.connected) {
          socketRef.current.emit('join_room', { problemSlug: newSlug })
        }
      }
    }
    const id = setInterval(check, 1000)
    window.addEventListener('popstate', check)
    return () => {
      clearInterval(id)
      window.removeEventListener('popstate', check)
    }
  }, [])

  // Create and manage the socket connection
  useEffect(() => {
    let socket: Socket

    const connect = async () => {
      const token = await getStoredToken()
      if (!token) return

      socket = io(SERVER_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      })
      socketRef.current = socket

      socket.on('connect', () => {
        setConnected(true)
        const slug = slugRef.current
        if (slug) socket.emit('join_room', { problemSlug: slug })
      })

      socket.on('disconnect', () => setConnected(false))

      socket.on('room_state', (data: {
        users: RoomUser[]
        messages: RoomMessage[]
        roomNumber: number
        rooms: SubRoomInfo[]
      }) => {
        setRoomUsers(data.users)
        setMessages(data.messages)
        setCurrentRoomNumber(data.roomNumber)
        setAvailableRooms(data.rooms)
      })

      socket.on('rooms_updated', (rooms: SubRoomInfo[]) => {
        setAvailableRooms(rooms)
      })

      socket.on('user_joined', (user: RoomUser) => {
        setRoomUsers((prev) => [...prev.filter((u) => u.id !== user.id), user])
      })

      socket.on('user_left', ({ id }: { id: string }) => {
        setRoomUsers((prev) => prev.filter((u) => u.id !== id))
      })

      socket.on('new_message', (msg: RoomMessage) => {
        setMessages((prev) => [...prev, msg])
      })

      // room_full: auto-bump to next available room
      socket.on('room_full', ({ roomNumber }: { roomNumber: number }) => {
        const slug = slugRef.current
        if (!slug) return
        setAvailableRooms((prev) => {
          const next = prev.find((r) => r.number !== roomNumber && r.userCount < r.capacity)
          if (next) {
            socket.emit('join_room', { problemSlug: slug, roomNumber: next.number })
          }
          return prev
        })
      })
    }

    void connect()

    return () => {
      socket?.disconnect()
      socketRef.current = null
      setConnected(false)
      setRoomUsers([])
      setMessages([])
      setCurrentRoomNumber(null)
      setAvailableRooms([])
    }
  }, [])

  const sendMessage = useCallback((content: string) => {
    socketRef.current?.emit('send_message', { content })
  }, [])

  const joinRoom = useCallback((roomNumber: number) => {
    const slug = slugRef.current
    if (!slug || !socketRef.current?.connected) return
    socketRef.current.emit('join_room', { problemSlug: slug, roomNumber })
  }, [])

  return { roomUsers, messages, connected, problemSlug, currentRoomNumber, availableRooms, sendMessage, joinRoom }
}
