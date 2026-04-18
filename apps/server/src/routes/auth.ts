import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomBytes } from 'node:crypto'
import { generateCodeVerifier, generateState } from 'arctic'
import { google } from '../lib/google-oauth.js'
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  REFRESH_TOKEN_TTL_DAYS,
} from '../lib/tokens.js'
import { db } from '../db/index.js'
import { users, refreshTokens } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Validate that the redirect_uri is a chromiumapp.org or chrome-extension:// URL. */
function isValidExtensionRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri)
    // Accept https://<id>.chromiumapp.org/ URIs
    if (url.protocol === 'https:' && /^[a-z]{32}\.chromiumapp\.org$/.test(url.hostname)) {
      return true
    }
    // Accept chrome-extension://<id>/ URIs (for local testing)
    if (url.protocol === 'chrome-extension:' && /^[a-z]{32}$/.test(url.hostname)) {
      return true
    }
    return false
  } catch {
    return false
  }
}

/** Build redirect URL with token params appended. */
function buildTokenRedirect(
  redirectUri: string,
  accessToken: string,
  refreshToken: string,
): string {
  const url = new URL(redirectUri)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('refresh_token', refreshToken)
  url.searchParams.set('expires_in', '900')
  return url.toString()
}

// ─── Google user info shape ───────────────────────────────────────────────────

interface GoogleUserInfo {
  sub: string
  email: string
  name: string
  picture?: string
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /auth/google ─────────────────────────────────────────────────────────
  fastify.get(
    '/auth/google',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const query = request.query as Record<string, string | undefined>
      const redirectUri = query['redirect_uri']

      if (!redirectUri || !isValidExtensionRedirectUri(redirectUri)) {
        reply
          .code(400)
          .send({ ok: false, error: 'Invalid or missing redirect_uri. Must be a chromiumapp.org URL.' })
        return
      }

      // Generate PKCE and state
      const state = generateState()
      const codeVerifier = generateCodeVerifier()

      // Store { codeVerifier, redirectUri } in a short-lived httpOnly cookie
      // Cookie name includes the state for uniqueness
      const cookieName = `lc_oauth_${state}`
      const cookieValue = JSON.stringify({ codeVerifier, redirectUri })

      reply.setCookie(cookieName, cookieValue, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      })

      // Build the Google authorization URL with PKCE
      const authUrl = google.createAuthorizationURL(state, codeVerifier, [
        'openid',
        'email',
        'profile',
      ])

      reply.redirect(authUrl.toString())
    },
  )

  // ── GET /auth/google/callback ─────────────────────────────────────────────────
  fastify.get(
    '/auth/google/callback',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const query = request.query as Record<string, string | undefined>
      const code = query['code']
      const state = query['state']

      if (!code || !state) {
        reply.code(400).send({ ok: false, error: 'Missing code or state parameter' })
        return
      }

      // Recover state cookie
      const cookieName = `lc_oauth_${state}`
      const rawCookie = request.cookies?.[cookieName]

      if (!rawCookie) {
        reply.code(400).send({ ok: false, error: 'OAuth state mismatch or session expired' })
        return
      }

      // Parse stored session data
      let session: { codeVerifier: string; redirectUri: string }
      try {
        session = JSON.parse(rawCookie) as { codeVerifier: string; redirectUri: string }
        if (
          typeof session.codeVerifier !== 'string' ||
          typeof session.redirectUri !== 'string'
        ) {
          throw new Error('Malformed session cookie')
        }
      } catch {
        reply.code(400).send({ ok: false, error: 'Invalid OAuth session cookie' })
        return
      }

      // Clear the cookie
      reply.clearCookie(cookieName, { path: '/' })

      // Exchange code for tokens
      let tokens
      try {
        tokens = await google.validateAuthorizationCode(code, session.codeVerifier)
      } catch (err) {
        fastify.log.error({ err }, 'Google OAuth code exchange failed')
        reply.code(400).send({ ok: false, error: 'Failed to exchange authorization code' })
        return
      }

      // Fetch user info from Google OpenID Connect endpoint
      let userInfo: GoogleUserInfo
      try {
        const accessToken = tokens.accessToken()
        const userinfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!userinfoRes.ok) {
          throw new Error(`Google userinfo returned ${userinfoRes.status}`)
        }
        userInfo = (await userinfoRes.json()) as GoogleUserInfo
        if (!userInfo.sub || !userInfo.email || !userInfo.name) {
          throw new Error('Incomplete user info from Google')
        }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to fetch Google user info')
        reply.code(502).send({ ok: false, error: 'Failed to fetch user info from Google' })
        return
      }

      // Upsert user in database
      let userId: string
      try {
        const [upserted] = await db
          .insert(users)
          .values({
            googleId: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            avatarUrl: userInfo.picture ?? null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: users.googleId,
            set: {
              email: userInfo.email,
              name: userInfo.name,
              avatarUrl: userInfo.picture ?? null,
              updatedAt: new Date(),
            },
          })
          .returning({ id: users.id })

        if (!upserted) throw new Error('Upsert returned no rows')
        userId = upserted.id
      } catch (err) {
        fastify.log.error({ err }, 'Failed to upsert user')
        reply.code(500).send({ ok: false, error: 'Database error' })
        return
      }

      // Issue JWT access token
      const accessToken = await signAccessToken(userId)

      // Issue refresh token and store hash
      const refreshToken = generateRefreshToken()
      const tokenHash = hashToken(refreshToken)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS)

      try {
        await db.insert(refreshTokens).values({
          userId,
          tokenHash,
          expiresAt,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to store refresh token')
        reply.code(500).send({ ok: false, error: 'Database error' })
        return
      }

      // Redirect back to the extension with tokens as query params
      const finalRedirect = buildTokenRedirect(
        session.redirectUri,
        accessToken,
        refreshToken,
      )
      reply.redirect(finalRedirect)
    },
  )

  // ── POST /auth/refresh ───────────────────────────────────────────────────────
  fastify.post(
    '/auth/refresh',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const body = request.body as Record<string, unknown> | null | undefined
      const incomingRefreshToken = body?.['refresh_token']

      if (typeof incomingRefreshToken !== 'string' || !incomingRefreshToken) {
        reply.code(400).send({ ok: false, error: 'Missing refresh_token' })
        return
      }

      const tokenHash = hashToken(incomingRefreshToken)
      const now = new Date()

      // Look up the token hash in DB
      const [existing] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1)

      if (!existing) {
        reply.code(401).send({ ok: false, error: 'Invalid refresh token' })
        return
      }

      if (existing.expiresAt < now) {
        // Clean up expired token
        await db.delete(refreshTokens).where(eq(refreshTokens.id, existing.id))
        reply.code(401).send({ ok: false, error: 'Refresh token expired' })
        return
      }

      // Rotate: delete old token, issue new one
      const newRefreshToken = generateRefreshToken()
      const newTokenHash = hashToken(newRefreshToken)
      const newExpiresAt = new Date()
      newExpiresAt.setDate(newExpiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS)

      await db.delete(refreshTokens).where(eq(refreshTokens.id, existing.id))
      await db.insert(refreshTokens).values({
        userId: existing.userId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      })

      const newAccessToken = await signAccessToken(existing.userId)

      reply.code(200).send({
        ok: true,
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: 900,
      })
    },
  )

  // ── GET /auth/me ─────────────────────────────────────────────────────────────
  fastify.get(
    '/auth/me',
    { preHandler: fastify.authenticate },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const user = request.user
      if (!user) {
        reply.code(401).send({ ok: false, error: 'Unauthorized' })
        return
      }

      const [dbUser] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)

      if (!dbUser) {
        reply.code(404).send({ ok: false, error: 'User not found' })
        return
      }

      reply.code(200).send({
        ok: true,
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        avatarUrl: dbUser.avatarUrl,
        createdAt: dbUser.createdAt,
      })
    },
  )

  // ── POST /auth/logout ────────────────────────────────────────────────────────
  fastify.post(
    '/auth/logout',
    { preHandler: fastify.authenticate },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const user = request.user
      if (!user) {
        reply.code(401).send({ ok: false, error: 'Unauthorized' })
        return
      }

      const body = request.body as Record<string, unknown> | null | undefined
      const incomingRefreshToken = body?.['refresh_token']

      if (typeof incomingRefreshToken === 'string' && incomingRefreshToken) {
        // Delete specific token
        const tokenHash = hashToken(incomingRefreshToken)
        await db
          .delete(refreshTokens)
          .where(
            and(
              eq(refreshTokens.tokenHash, tokenHash),
              eq(refreshTokens.userId, user.id),
            ),
          )
      } else {
        // Delete all tokens for this user
        await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id))
      }

      reply.code(204).send()
    },
  )
}
