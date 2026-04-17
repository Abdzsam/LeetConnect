import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  integer,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const channelTypeEnum = pgEnum("channel_type", ["text", "voice"]);
export const messageTypeEnum = pgEnum("message_type", ["text", "system"]);
export const friendshipStatusEnum = pgEnum("friendship_status", [
  "pending",
  "accepted",
  "blocked",
]);

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleId: text("google_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  leetcodeHandle: text("leetcode_handle").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Problem rooms ─────────────────────────────────────────────────────────────

export const problemRooms = pgTable("problem_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  problemSlug: text("problem_slug").notNull().unique(),
  problemTitle: text("problem_title"),
  difficulty: difficultyEnum("difficulty"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Channels ──────────────────────────────────────────────────────────────────

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => problemRooms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: channelTypeEnum("type").notNull().default("text"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Messages ──────────────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    type: messageTypeEnum("type").notNull().default("text"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("messages_channel_created_idx").on(table.channelId, table.createdAt)]
);

// ── DM threads ────────────────────────────────────────────────────────────────

export const dmThreads = pgTable(
  "dm_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantA: uuid("participant_a")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    participantB: uuid("participant_b")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("dm_threads_participants_idx").on(
      table.participantA,
      table.participantB
    ),
  ]
);

// ── DM messages ───────────────────────────────────────────────────────────────

export const dmMessages = pgTable(
  "dm_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => dmThreads.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("dm_messages_thread_created_idx").on(table.threadId, table.createdAt)]
);

// ── Friendships ───────────────────────────────────────────────────────────────

export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("friendships_pair_idx").on(
      table.requesterId,
      table.addresseeId
    ),
    check(
      "friendships_no_self",
      sql`${table.requesterId} != ${table.addresseeId}`
    ),
  ]
);

// ── User sessions (refresh tokens) ───────────────────────────────────────────

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  userAgent: text("user_agent"),
});
