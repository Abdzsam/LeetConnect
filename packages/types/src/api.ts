import type { User, Channel, Message, DmMessage, DmThread, Friendship, ProblemRoom } from "./entities.js";

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

export interface MeResponse {
  user: User;
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export interface RoomWithChannels {
  room: ProblemRoom;
  channels: Channel[];
}

// ── Messages ──────────────────────────────────────────────────────────────────

export interface MessageHistoryResponse {
  messages: Message[];
  hasMore: boolean;
  cursor: string | null;
}

// ── DMs ───────────────────────────────────────────────────────────────────────

export interface DmThreadWithLastMessage {
  thread: DmThread;
  other: Pick<User, "id" | "displayName" | "avatarUrl">;
  lastMessage: DmMessage | null;
  unreadCount: number;
}

export interface DmHistoryResponse {
  messages: DmMessage[];
  hasMore: boolean;
  cursor: string | null;
}

// ── Friends ───────────────────────────────────────────────────────────────────

export interface FriendWithUser {
  friendship: Friendship;
  user: Pick<User, "id" | "displayName" | "avatarUrl" | "leetcodeHandle">;
  isOnline: boolean;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserSearchResult {
  users: Pick<User, "id" | "displayName" | "avatarUrl" | "leetcodeHandle">[];
}
