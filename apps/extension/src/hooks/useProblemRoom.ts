import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

declare const __SERVER_URL__: string
const SERVER_URL = __SERVER_URL__

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

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

export interface VoiceUser {
  socketId: string
  user: RoomUser
}

export interface SubRoomInfo {
  number: number
  userCount: number
  capacity: number
}

interface RoomStatePayload {
  users: RoomUser[]
  messages: RoomMessage[]
  roomNumber: number
  rooms: SubRoomInfo[]
  voiceUsers?: VoiceUser[]
}

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

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export function useProblemRoom() {
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([])
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [currentRoomNumber, setCurrentRoomNumber] = useState<number | null>(null)
  const [availableRooms, setAvailableRooms] = useState<SubRoomInfo[]>([])
  const [problemSlug, setProblemSlug] = useState<string | null>(() =>
    getProblemSlug(window.location.pathname),
  )
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceUser[]>([])
  const [voiceJoined, setVoiceJoined] = useState(false)
  const [voiceConnecting, setVoiceConnecting] = useState(false)
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [speakingSocketIds, setSpeakingSocketIds] = useState<Set<string>>(new Set())
  const [localSocketId, setLocalSocketId] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const slugRef = useRef(problemSlug)
  const voiceJoinedRef = useRef(false)
  const voiceMutedRef = useRef(false)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map())
  const analyserBuffersRef = useRef<Map<string, Float32Array>>(new Map())
  const speakLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    voiceMutedRef.current = voiceMuted
  }, [voiceMuted])

  const monitorStream = useCallback((socketId: string, stream: MediaStream) => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') void ctx.resume()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.3
      source.connect(analyser)
      analysersRef.current.set(socketId, analyser)
      analyserBuffersRef.current.set(socketId, new Float32Array(analyser.fftSize))
    } catch {
      // Audio monitoring unavailable in this context
    }
  }, [])

  const startSpeakLoop = useCallback(() => {
    if (speakLoopRef.current) return
    speakLoopRef.current = setInterval(() => {
      const speaking = new Set<string>()
      for (const [id, analyser] of analysersRef.current) {
        const buf = analyserBuffersRef.current.get(id)
        if (!buf) continue
        analyser.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>)
        let sum = 0
        for (const s of buf) sum += s * s
        if (Math.sqrt(sum / buf.length) > 0.01) speaking.add(id)
      }
      setSpeakingSocketIds(speaking)
    }, 80)
  }, [])

  const stopMonitoringAll = useCallback(() => {
    if (speakLoopRef.current) {
      clearInterval(speakLoopRef.current)
      speakLoopRef.current = null
    }
    analysersRef.current.clear()
    analyserBuffersRef.current.clear()
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close()
      }
    } catch { /* ignore */ }
    audioCtxRef.current = null
    setSpeakingSocketIds(new Set())
  }, [])

  const removeRemoteAudio = useCallback((socketId: string) => {
    const audio = remoteAudioElsRef.current.get(socketId)
    if (!audio) return
    audio.pause()
    audio.srcObject = null
    audio.remove()
    remoteAudioElsRef.current.delete(socketId)
  }, [])

  const closePeerConnection = useCallback((socketId: string) => {
    const peer = peerConnectionsRef.current.get(socketId)
    if (!peer) return
    peer.onicecandidate = null
    peer.ontrack = null
    peer.close()
    peerConnectionsRef.current.delete(socketId)
    pendingIceCandidatesRef.current.delete(socketId)
    removeRemoteAudio(socketId)
  }, [removeRemoteAudio])

  const closeAllPeerConnections = useCallback(() => {
    for (const socketId of peerConnectionsRef.current.keys()) {
      closePeerConnection(socketId)
    }
  }, [closePeerConnection])

  const ensureLocalStream = useCallback(async (): Promise<MediaStream> => {
    if (localStreamRef.current) return localStreamRef.current
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not available in this browser context.')
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })

    localStreamRef.current = stream
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !voiceMutedRef.current
    })
    return stream
  }, [])

  const createPeerConnection = useCallback(async (targetSocketId: string): Promise<RTCPeerConnection> => {
    const existing = peerConnectionsRef.current.get(targetSocketId)
    if (existing) return existing

    const socket = socketRef.current
    if (!socket) throw new Error('Voice signaling is unavailable.')

    const peer = new RTCPeerConnection(RTC_CONFIG)
    peerConnectionsRef.current.set(targetSocketId, peer)

    peer.onicecandidate = (event) => {
      if (!event.candidate) return
      socket.emit('voice_ice_candidate', {
        targetSocketId,
        candidate: event.candidate.toJSON(),
      })
    }

    peer.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream) return

      let audio = remoteAudioElsRef.current.get(targetSocketId)
      if (!audio) {
        audio = document.createElement('audio')
        audio.autoplay = true
        audio.setAttribute('playsinline', 'true')
        audio.style.display = 'none'
        document.body.appendChild(audio)
        remoteAudioElsRef.current.set(targetSocketId, audio)
      }

      audio.srcObject = stream
      void audio.play().catch(() => {
        setVoiceError('Chrome blocked autoplay for a remote audio stream. Rejoin voice after interacting with the page.')
      })
      monitorStream(targetSocketId, stream)
    }

    const stream = await ensureLocalStream()
    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream)
    })

    return peer
  }, [ensureLocalStream, monitorStream])

  const flushPendingIceCandidates = useCallback(async (socketId: string) => {
    const peer = peerConnectionsRef.current.get(socketId)
    if (!peer?.remoteDescription) return

    const pending = pendingIceCandidatesRef.current.get(socketId) ?? []
    pendingIceCandidatesRef.current.delete(socketId)

    for (const candidate of pending) {
      await peer.addIceCandidate(candidate)
    }
  }, [])

  const leaveVoice = useCallback(() => {
    socketRef.current?.emit('leave_voice')
    closeAllPeerConnections()
    stopStream(localStreamRef.current)
    localStreamRef.current = null
    stopMonitoringAll()
    setLocalSocketId(null)
    setVoiceParticipants([])
    setVoiceJoined(false)
    setVoiceConnecting(false)
    setVoiceMuted(false)
    setVoiceError(null)
    voiceJoinedRef.current = false
    voiceMutedRef.current = false
  }, [closeAllPeerConnections, stopMonitoringAll])

  const joinVoice = useCallback(async () => {
    if (!problemSlug) {
      setVoiceError('Open a LeetCode problem before joining voice.')
      return
    }

    const socket = socketRef.current
    if (!socket?.connected || currentRoomNumber === null) {
      setVoiceError('Connect to the room before joining voice.')
      return
    }

    setVoiceConnecting(true)
    setVoiceError(null)

    try {
      const stream = await ensureLocalStream()
      const sid = socket.id ?? ''
      setLocalSocketId(sid)
      monitorStream(sid, stream)
      startSpeakLoop()
      voiceJoinedRef.current = true
      setVoiceJoined(true)
      socket.emit('join_voice')
    } catch (error) {
      stopStream(localStreamRef.current)
      localStreamRef.current = null
      stopMonitoringAll()
      setLocalSocketId(null)
      setVoiceJoined(false)
      voiceJoinedRef.current = false
      setVoiceError(error instanceof Error ? error.message : 'Unable to access your microphone.')
    } finally {
      setVoiceConnecting(false)
    }
  }, [currentRoomNumber, ensureLocalStream, monitorStream, problemSlug, startSpeakLoop, stopMonitoringAll])

  const toggleMute = useCallback(() => {
    const nextMuted = !voiceMutedRef.current
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    voiceMutedRef.current = nextMuted
    setVoiceMuted(nextMuted)
  }, [])

  useEffect(() => {
    const check = () => {
      const newSlug = getProblemSlug(window.location.pathname)
      if (newSlug !== slugRef.current) {
        slugRef.current = newSlug
        setProblemSlug(newSlug)
        if (voiceJoinedRef.current) {
          leaveVoice()
        }
        setCurrentRoomNumber(null)
        setAvailableRooms([])
        setRoomUsers([])
        setVoiceParticipants([])
        if (newSlug && socketRef.current?.connected) {
          setMessagesLoading(true)
          socketRef.current.emit('join_room', { problemSlug: newSlug })
        } else {
          setMessages([])
          setMessagesLoading(false)
        }
      }
    }

    const id = setInterval(check, 1000)
    window.addEventListener('popstate', check)
    return () => {
      clearInterval(id)
      window.removeEventListener('popstate', check)
    }
  }, [leaveVoice])

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
        if (slug) {
          setMessagesLoading(true)
          socket.emit('join_room', { problemSlug: slug })
        } else {
          setMessagesLoading(false)
        }
      })

      socket.on('disconnect', () => {
        setConnected(false)
        closeAllPeerConnections()
        setVoiceParticipants([])
      })

      socket.on('room_state', (data: RoomStatePayload) => {
        setRoomUsers(data.users)
        setMessages(data.messages)
        setMessagesLoading(false)
        setCurrentRoomNumber(data.roomNumber)
        setAvailableRooms(data.rooms)
        setVoiceParticipants(data.voiceUsers ?? [])

        if (voiceJoinedRef.current) {
          socket.emit('join_voice')
        }
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

      socket.on('voice_state', async (data: { users: VoiceUser[]; peers: string[] }) => {
        setVoiceParticipants(data.users)

        for (const peerSocketId of data.peers) {
          const peer = await createPeerConnection(peerSocketId)
          const offer = await peer.createOffer()
          await peer.setLocalDescription(offer)
          socket.emit('voice_offer', {
            targetSocketId: peerSocketId,
            description: offer,
          })
        }
      })

      socket.on('voice_user_joined', (participant: VoiceUser) => {
        setVoiceParticipants((prev) => {
          const next = prev.filter((entry) => entry.socketId !== participant.socketId)
          next.push(participant)
          return next
        })
      })

      socket.on('voice_user_left', ({ socketId }: { socketId: string }) => {
        setVoiceParticipants((prev) => prev.filter((entry) => entry.socketId !== socketId))
        closePeerConnection(socketId)
      })

      socket.on(
        'voice_offer',
        async ({ fromSocketId, description }: { fromSocketId: string; description: RTCSessionDescriptionInit }) => {
          const peer = await createPeerConnection(fromSocketId)
          await peer.setRemoteDescription(description)
          await flushPendingIceCandidates(fromSocketId)
          const answer = await peer.createAnswer()
          await peer.setLocalDescription(answer)
          socket.emit('voice_answer', {
            targetSocketId: fromSocketId,
            description: answer,
          })
        },
      )

      socket.on(
        'voice_answer',
        async ({ fromSocketId, description }: { fromSocketId: string; description: RTCSessionDescriptionInit }) => {
          const peer = peerConnectionsRef.current.get(fromSocketId)
          if (!peer) return
          await peer.setRemoteDescription(description)
          await flushPendingIceCandidates(fromSocketId)
        },
      )

      socket.on(
        'voice_ice_candidate',
        async ({ fromSocketId, candidate }: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
          const peer = await createPeerConnection(fromSocketId)
          if (!peer.remoteDescription) {
            const pending = pendingIceCandidatesRef.current.get(fromSocketId) ?? []
            pending.push(candidate)
            pendingIceCandidatesRef.current.set(fromSocketId, pending)
            return
          }
          await peer.addIceCandidate(candidate)
        },
      )
    }

    void connect()

    return () => {
      socket?.disconnect()
      socketRef.current = null
      closeAllPeerConnections()
      stopStream(localStreamRef.current)
      localStreamRef.current = null
      stopMonitoringAll()
      setLocalSocketId(null)
      setConnected(false)
      setRoomUsers([])
      setMessages([])
      setMessagesLoading(true)
      setCurrentRoomNumber(null)
      setAvailableRooms([])
      setVoiceParticipants([])
      setVoiceJoined(false)
      setVoiceConnecting(false)
      setVoiceMuted(false)
      setVoiceError(null)
      voiceJoinedRef.current = false
      voiceMutedRef.current = false
    }
  }, [closeAllPeerConnections, closePeerConnection, createPeerConnection, flushPendingIceCandidates, stopMonitoringAll])

  const sendMessage = useCallback((content: string) => {
    socketRef.current?.emit('send_message', { content })
  }, [])

  const joinRoom = useCallback((roomNumber: number) => {
    const slug = slugRef.current
    if (!slug || !socketRef.current?.connected) return
    if (voiceJoinedRef.current) {
      leaveVoice()
    }
    socketRef.current.emit('join_room', { problemSlug: slug, roomNumber })
  }, [leaveVoice])

  return {
    roomUsers,
    messages,
    messagesLoading,
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
    speakingSocketIds,
    localSocketId,
  }
}
