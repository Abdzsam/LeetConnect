import { SignJWT, jwtVerify } from 'jose'
import { config } from '../config.js'
import { createHash, randomBytes } from 'node:crypto'

const accessSecret = new TextEncoder().encode(config.jwtSecret)
const refreshSecret = new TextEncoder().encode(config.jwtRefreshSecret)

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(accessSecret)
}

export async function verifyAccessToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, accessSecret)
  if (payload['type'] !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token')
  }
  return { sub: payload.sub }
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Suppress unused import warning — refreshSecret is available for future use
void refreshSecret

export const REFRESH_TOKEN_TTL_DAYS = 30
