export interface User {
  id: string;
  googleId: string;
  displayName: string;
  avatarUrl: string | null;
  leetcodeHandle: string | null;
  createdAt: string;
}

export interface ProblemRoom {
  id: string;
  problemSlug: string;
  problemTitle: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  createdAt: string;
}

export type ChannelType = "text" | "voice";

export interface Channel {
  id: string;
  roomId: string;
  name: string;
  type: ChannelType;
  position: number;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  sender: Pick<User, "id" | "displayName" | "avatarUrl">;
  content: string;
  type: "text" | "system";
  deletedAt: string | null;
  createdAt: string;
}

export interface DmThread {
  id: string;
  participantA: string;
  participantB: string;
  createdAt: string;
}

export interface DmMessage {
  id: string;
  threadId: string;
  sender: Pick<User, "id" | "displayName" | "avatarUrl">;
  content: string;
  createdAt: string;
}

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
}

export interface OnlineUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: number;
}
