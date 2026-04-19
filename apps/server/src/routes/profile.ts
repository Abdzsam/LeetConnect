import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db/index.js'
import { users, userSocialLinks, SOCIAL_PLATFORMS, type SocialPlatform } from '../db/schema.js'
import { eq } from 'drizzle-orm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BIO_MAX = 300

export function isValidSocialValue(platform: SocialPlatform, value: string): boolean {
  const v = value.trim()
  if (!v || v.length > 200) return false
  if (platform === 'email') return EMAIL_RE.test(v)
  // Reject strings that are purely whitespace or contain newlines
  if (/[\r\n]/.test(v)) return false
  return true
}

export function buildSocialUrl(platform: SocialPlatform, value: string): string | null {
  const v = value.trim()
  if (!v) return null
  switch (platform) {
    case 'github':     return `https://github.com/${v}`
    case 'linkedin':   return v.startsWith('http') ? v : `https://linkedin.com/in/${v}`
    case 'instagram':  return `https://instagram.com/${v}`
    case 'discord':    return null
    case 'hackerrank': return `https://www.hackerrank.com/profile/${v}`
    case 'codeforces': return `https://codeforces.com/profile/${v}`
    case 'email':      return `mailto:${v}`
    default:           return null
  }
}

export function normalizeSocialLinks(
  raw: unknown[],
): Array<{ platform: SocialPlatform; value: string }> {
  const seen = new Set<SocialPlatform>()
  const result: Array<{ platform: SocialPlatform; value: string }> = []

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const { platform, value } = item as Record<string, unknown>
    if (typeof platform !== 'string') continue
    if (!SOCIAL_PLATFORMS.includes(platform as SocialPlatform)) continue
    if (typeof value !== 'string') continue
    const p = platform as SocialPlatform
    if (seen.has(p)) continue  // deduplicate per platform
    const trimmed = value.trim()
    if (!isValidSocialValue(p, trimmed)) continue
    seen.add(p)
    result.push({ platform: p, value: trimmed })
  }
  return result
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /profile ─────────────────────────────────────────────────────────────
  fastify.get(
    '/profile',
    { preHandler: fastify.authenticate },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const userId = request.user!.id
      const [user] = await db
        .select({ name: users.name, bio: users.bio, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      reply.code(200).send({ ok: true, ...user })
    },
  )

  // ── PUT /profile ─────────────────────────────────────────────────────────────
  fastify.put(
    '/profile',
    { preHandler: fastify.authenticate },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const body = request.body as Record<string, unknown> | null | undefined
      const rawBio = body?.['bio']

      if (rawBio !== undefined && rawBio !== null) {
        if (typeof rawBio !== 'string') {
          reply.code(400).send({ ok: false, error: 'bio must be a string' })
          return
        }
        if (rawBio.length > BIO_MAX) {
          reply.code(400).send({ ok: false, error: `bio must be ${BIO_MAX} characters or fewer` })
          return
        }
      }

      const bio = typeof rawBio === 'string' ? rawBio.trim() || null : undefined

      await db.update(users)
        .set({ ...(bio !== undefined ? { bio } : {}), updatedAt: new Date() })
        .where(eq(users.id, request.user!.id))

      reply.code(200).send({ ok: true })
    },
  )

  // ── GET /profile/socials ─────────────────────────────────────────────────────
  fastify.get(
    '/profile/socials',
    { preHandler: fastify.authenticate },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const userId = request.user!.id
      const links = await db
        .select({ platform: userSocialLinks.platform, value: userSocialLinks.value })
        .from(userSocialLinks)
        .where(eq(userSocialLinks.userId, userId))

      reply.code(200).send({ ok: true, links })
    },
  )

  // ── PUT /profile/socials ─────────────────────────────────────────────────────
  fastify.put(
    '/profile/socials',
    { preHandler: fastify.authenticate },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const body = request.body as Record<string, unknown> | null | undefined
      const raw = body?.['links']

      if (!Array.isArray(raw)) {
        reply.code(400).send({ ok: false, error: 'links must be an array' })
        return
      }

      const valid = normalizeSocialLinks(raw)
      const userId = request.user!.id

      await db.delete(userSocialLinks).where(eq(userSocialLinks.userId, userId))
      if (valid.length > 0) {
        await db.insert(userSocialLinks).values(
          valid.map(({ platform, value }) => ({ userId, platform, value })),
        )
      }

      reply.code(200).send({ ok: true, links: valid })
    },
  )

  // ── GET /users/:userId/socials ───────────────────────────────────────────────
  fastify.get(
    '/users/:userId/socials',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { userId } = request.params as { userId: string }

      if (!UUID_RE.test(userId)) {
        reply.code(400).send({ ok: false, error: 'Invalid userId' })
        return
      }

      const [user] = await db
        .select({ id: users.id, name: users.name, bio: users.bio, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user) {
        reply.code(404).send({ ok: false, error: 'User not found' })
        return
      }

      const links = await db
        .select({ platform: userSocialLinks.platform, value: userSocialLinks.value })
        .from(userSocialLinks)
        .where(eq(userSocialLinks.userId, userId))

      reply.code(200).send({
        ok: true,
        name: user.name,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        links,
      })
    },
  )
}
