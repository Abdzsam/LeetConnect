import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const SOCIAL_PLATFORMS = [
  'github', 'linkedin', 'instagram', 'discord',
  'hackerrank', 'codeforces', 'email',
] as const
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number]

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleId: text('google_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Refresh Tokens ───────────────────────────────────────────────────────────

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
    tokenHashIdx: index('refresh_tokens_token_hash_idx').on(table.tokenHash),
  }),
)

// ─── Problem Messages ─────────────────────────────────────────────────────────

export const problemMessages = pgTable(
  'problem_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: text('room_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roomIdIdx: index('problem_messages_room_id_idx').on(table.roomId),
    createdAtIdx: index('problem_messages_created_at_idx').on(table.createdAt),
  }),
)

// ─── User Social Links ────────────────────────────────────────────────────────

export const userSocialLinks = pgTable(
  'user_social_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform').$type<SocialPlatform>().notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userPlatformUnique: unique('user_platform_unique').on(table.userId, table.platform),
    userIdIdx: index('user_social_links_user_id_idx').on(table.userId),
  }),
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  socialLinks: many(userSocialLinks),
}))

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}))

export const userSocialLinksRelations = relations(userSocialLinks, ({ one }) => ({
  user: one(users, { fields: [userSocialLinks.userId], references: [users.id] }),
}))

// ─── Inferred types ───────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type RefreshToken = typeof refreshTokens.$inferSelect
export type NewRefreshToken = typeof refreshTokens.$inferInsert
export type ProblemMessage = typeof problemMessages.$inferSelect
export type NewProblemMessage = typeof problemMessages.$inferInsert
export type UserSocialLink = typeof userSocialLinks.$inferSelect
export type NewUserSocialLink = typeof userSocialLinks.$inferInsert
