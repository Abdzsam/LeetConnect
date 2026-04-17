import type { OnlineUser, Message, DmMessage, Channel } from "./entities.js";

// ── /presence namespace ───────────────────────────────────────────────────────

export interface PresenceClientToServer {
  join_problem: (slug: string) => void;
  leave_problem: (slug: string) => void;
  heartbeat: (slug: string) => void;
}

export interface PresenceServerToClient {
  room_users_updated: (users: OnlineUser[]) => void;
  user_joined: (user: OnlineUser) => void;
  user_left: (userId: string) => void;
}

// ── /messaging namespace ──────────────────────────────────────────────────────

export interface SendMessagePayload {
  channelId: string;
  content: string;
}

export interface SendDmPayload {
  threadId: string;
  content: string;
}

export interface TypingPayload {
  channelId?: string;
  threadId?: string;
}

export interface MessagingClientToServer {
  send_message: (payload: SendMessagePayload) => void;
  send_dm: (payload: SendDmPayload) => void;
  typing_start: (payload: TypingPayload) => void;
  typing_stop: (payload: TypingPayload) => void;
  join_channel: (channelId: string) => void;
  join_dm_thread: (threadId: string) => void;
}

export interface TypingIndicator {
  userId: string;
  displayName: string;
  channelId?: string;
  threadId?: string;
}

export interface MessagingServerToClient {
  new_message: (message: Message) => void;
  new_dm: (message: DmMessage) => void;
  typing_indicator: (payload: TypingIndicator) => void;
  channels_updated: (channels: Channel[]) => void;
}

// ── /voice namespace ──────────────────────────────────────────────────────────

export interface VoiceOfferPayload {
  to: string;
  sdp: RTCSessionDescriptionInit;
}

export interface VoiceAnswerPayload {
  to: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidatePayload {
  to: string;
  candidate: RTCIceCandidateInit;
}

export interface VoiceClientToServer {
  join_voice_channel: (channelId: string) => void;
  leave_voice_channel: (channelId: string) => void;
  offer: (payload: VoiceOfferPayload) => void;
  answer: (payload: VoiceAnswerPayload) => void;
  ice_candidate: (payload: IceCandidatePayload) => void;
}

export interface PeerJoinedPayload {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface VoiceServerToClient {
  voice_peers: (userIds: string[]) => void;
  peer_joined: (payload: PeerJoinedPayload) => void;
  peer_left: (userId: string) => void;
  offer: (payload: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  answer: (payload: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  ice_candidate: (payload: {
    from: string;
    candidate: RTCIceCandidateInit;
  }) => void;
}
