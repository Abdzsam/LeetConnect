# LeetConnect — Setup Guide

## Prerequisites
- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- A Neon account (free): https://neon.tech
- An Upstash Redis account (free): https://upstash.com
- A Google Cloud project with OAuth 2.0 credentials

---

## 1. Google OAuth Setup

1. Go to https://console.cloud.google.com → Create project "LeetConnect"
2. Enable "Google Identity" API
3. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
4. Application type: **Web application**
5. Add Authorized redirect URIs:
   - `http://localhost:3001/auth/google/callback` (development)
   - `https://api.leetconnect.dev/auth/google/callback` (production)
6. Copy **Client ID** and **Client Secret**

---

## 2. Database Setup (Neon)

1. Create a Neon project at https://neon.tech
2. Copy the connection string (it looks like `postgresql://user:pass@host/db?sslmode=require`)

---

## 3. Redis Setup (Upstash)

1. Create a Redis database at https://upstash.com
2. Copy the **TLS connection URL** (starts with `rediss://`)

---

## 4. Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example apps/server/.env
```

Edit `apps/server/.env`:
```
DATABASE_URL=postgresql://...            # From Neon
REDIS_URL=rediss://...                   # From Upstash
GOOGLE_CLIENT_ID=...                     # From Google Console
GOOGLE_CLIENT_SECRET=...                 # From Google Console
JWT_SECRET=<random 32+ char string>      # openssl rand -base64 32
JWT_REFRESH_SECRET=<random 32+ char>     # openssl rand -base64 32
ALLOWED_ORIGINS=chrome-extension://YOUR_EXT_ID,http://localhost:5173
PORT=3001
NODE_ENV=development
```

For the extension (optional, defaults to localhost):
```bash
cp .env.example apps/extension/.env
```

---

## 5. Database Migration

```bash
# Run from repo root
pnpm --filter @leetconnect/server db:push
```

This creates all tables in your Neon database.

---

## 6. Run Development

**Terminal 1 — Server:**
```bash
pnpm --filter @leetconnect/server dev
```

**Terminal 2 — Extension build (watch mode):**
```bash
pnpm --filter @leetconnect/extension dev
```

---

## 7. Load the Extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select `apps/extension/dist`
5. The LeetConnect extension is now installed

To test:
1. Go to https://leetcode.com/problems/two-sum
2. You'll see the LeetConnect sidebar on the right edge
3. Click it to expand, then sign in with Google
4. Open the same problem in a second tab/window to see presence working

---

## 8. Get Your Extension ID

After loading the extension, you'll see its ID on `chrome://extensions`.
Update your `.env`:
```
ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID_HERE
```
And restart the server.

---

## Project Structure

```
leetconnect/
├── apps/
│   ├── server/          # Fastify + Socket.io backend
│   └── extension/       # Chrome MV3 extension
│       └── dist/        # ← Load this in Chrome
└── packages/
    └── types/           # Shared TypeScript types
```

## Key Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all dependencies |
| `pnpm --filter @leetconnect/server dev` | Run server in dev mode |
| `pnpm --filter @leetconnect/extension dev` | Build extension in watch mode |
| `pnpm --filter @leetconnect/extension build` | Production build of extension |
| `pnpm --filter @leetconnect/server db:push` | Push schema to Neon |
| `pnpm --filter @leetconnect/server db:studio` | Open Drizzle Studio (DB GUI) |
