import { config as loadEnv } from 'dotenv'
loadEnv()

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required env var: ${name}`)
  return val
}

export const config = {
  databaseUrl: requireEnv('DATABASE_URL'),
  googleClientId: requireEnv('GOOGLE_CLIENT_ID'),
  googleClientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  // Comma-separated list of allowed Chrome extension IDs
  allowedExtensionIds: (process.env['ALLOWED_EXTENSION_IDS'] ?? '').split(',').filter(Boolean),
}
