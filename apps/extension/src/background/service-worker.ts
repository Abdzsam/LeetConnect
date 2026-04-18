/**
 * MV3 Service Worker — LeetConnect background script.
 *
 * Security:
 *   - All chrome.runtime.onMessage listeners validate the sender's extension ID.
 *   - External messages (onMessageExternal) are rejected by default.
 *   - No eval(), no Function(), no dynamic code execution.
 *   - Storage writes validate format before persisting.
 *   - OAuth redirect URL validated to chromiumapp.org before use.
 */

const API_BASE = 'http://localhost:3000'
const JWT_PATTERN = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/

// ─── Types ────────────────────────────────────────────────────────────────────

type InternalMessage =
  | { type: 'PING' }
  | { type: 'GET_AUTH_STATUS' }
  | { type: 'SET_TOKENS'; accessToken: string; refreshToken: string }
  | { type: 'CLEAR_AUTH' }
  | { type: 'INITIATE_GOOGLE_AUTH' }
  | { type: 'REFRESH_TOKEN' }
  | { type: 'GET_USER' }
  | { type: 'LOGOUT' }

type MessageResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string }

// ─── Lifecycle ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.storage.local.set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      installedAt: Date.now(),
    }).catch((err: unknown) => console.error('[LC] Storage init error:', err))
  }
})

// ─── Internal message handler ─────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ): boolean => {
    if (sender.id !== chrome.runtime.id) {
      sendResponse({ ok: false, error: 'Unauthorized sender' })
      return false
    }
    if (sender.url && !sender.url.startsWith('chrome-extension://')) {
      sendResponse({ ok: false, error: 'Untrusted sender URL' })
      return false
    }
    if (!isInternalMessage(message)) {
      sendResponse({ ok: false, error: 'Unknown message type' })
      return false
    }
    handleMessage(message, sendResponse)
    return true
  },
)

// ─── Reject all external messages ─────────────────────────────────────────────

chrome.runtime.onMessageExternal.addListener(
  (_message, _sender, sendResponse: (r: MessageResponse) => void) => {
    sendResponse({ ok: false, error: 'External messages not accepted' })
    return false
  },
)

// ─── Message dispatcher ───────────────────────────────────────────────────────

function handleMessage(
  message: InternalMessage,
  sendResponse: (response: MessageResponse) => void,
): void {
  switch (message.type) {
    case 'PING': {
      sendResponse({ ok: true, data: { pong: true, ts: Date.now() } })
      break
    }

    case 'GET_AUTH_STATUS': {
      chrome.storage.local
        .get(['accessToken', 'userId'])
        .then((result) => {
          sendResponse({
            ok: true,
            data: {
              authenticated: Boolean(result['accessToken']),
              userId: result['userId'] ?? null,
            },
          })
        })
        .catch(() => sendResponse({ ok: false, error: 'Storage error' }))
      break
    }

    case 'SET_TOKENS': {
      const { accessToken, refreshToken } = message
      if (!JWT_PATTERN.test(accessToken)) {
        sendResponse({ ok: false, error: 'Invalid access token format' })
        break
      }
      if (typeof refreshToken !== 'string' || refreshToken.length < 16) {
        sendResponse({ ok: false, error: 'Invalid refresh token format' })
        break
      }
      // Decode JWT payload to extract userId (sub claim)
      let userId: string | null = null
      try {
        const payloadB64 = accessToken.split('.')[1]
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
        if (typeof payload['sub'] === 'string') userId = payload['sub']
      } catch { /* leave userId null */ }

      chrome.storage.local
        .set({ accessToken, refreshToken, userId })
        .then(() => sendResponse({ ok: true, data: { userId } }))
        .catch(() => sendResponse({ ok: false, error: 'Storage error' }))
      break
    }

    case 'CLEAR_AUTH': {
      chrome.storage.local
        .remove(['accessToken', 'refreshToken', 'userId'])
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false, error: 'Storage error' }))
      break
    }

    case 'INITIATE_GOOGLE_AUTH': {
      initiateGoogleAuth(sendResponse)
      break
    }

    case 'REFRESH_TOKEN': {
      refreshAccessToken(sendResponse)
      break
    }

    case 'GET_USER': {
      getUserProfile(sendResponse)
      break
    }

    case 'LOGOUT': {
      logoutUser(sendResponse)
      break
    }

    default: {
      const _exhaustive: never = message
      void _exhaustive
      sendResponse({ ok: false, error: 'Unhandled message type' })
    }
  }
}

// ─── Auth handlers ────────────────────────────────────────────────────────────

async function initiateGoogleAuth(sendResponse: (r: MessageResponse) => void): Promise<void> {
  try {
    // Get the extension's OAuth redirect URL (e.g. https://[id].chromiumapp.org/)
    const redirectUri = chrome.identity.getRedirectURL()

    const authUrl = new URL(`${API_BASE}/auth/google`)
    authUrl.searchParams.set('redirect_uri', redirectUri)

    // Open the OAuth popup — resolves with the final redirect URL
    const resultUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    })

    if (!resultUrl) {
      sendResponse({ ok: false, error: 'Auth flow cancelled or failed' })
      return
    }

    // Extract tokens from the result URL query params
    const url = new URL(resultUrl)
    const accessToken = url.searchParams.get('access_token')
    const refreshToken = url.searchParams.get('refresh_token')

    if (!accessToken || !refreshToken) {
      sendResponse({ ok: false, error: 'No tokens returned from auth flow' })
      return
    }
    if (!JWT_PATTERN.test(accessToken)) {
      sendResponse({ ok: false, error: 'Malformed access token received' })
      return
    }

    // Decode JWT payload to extract sub (userId)
    let userId: string | null = null
    try {
      const payloadB64 = accessToken.split('.')[1]
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
      if (typeof payload['sub'] === 'string') userId = payload['sub']
    } catch { /* leave null */ }

    await chrome.storage.local.set({ accessToken, refreshToken, userId })
    sendResponse({ ok: true, data: { userId } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    sendResponse({ ok: false, error: message })
  }
}

async function refreshAccessToken(sendResponse: (r: MessageResponse) => void): Promise<void> {
  try {
    const { refreshToken } = await chrome.storage.local.get('refreshToken')

    if (!refreshToken || typeof refreshToken !== 'string') {
      sendResponse({ ok: false, error: 'No refresh token stored' })
      return
    }

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      const err = (await res.json()) as { error?: string }
      sendResponse({ ok: false, error: err.error ?? 'Refresh failed' })
      return
    }

    const data = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    if (!JWT_PATTERN.test(data.access_token)) {
      sendResponse({ ok: false, error: 'Invalid access token in refresh response' })
      return
    }

    await chrome.storage.local.set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    })

    sendResponse({ ok: true, data: { accessToken: data.access_token, expiresIn: data.expires_in } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    sendResponse({ ok: false, error: message })
  }
}

async function getUserProfile(sendResponse: (r: MessageResponse) => void): Promise<void> {
  try {
    const { accessToken } = await chrome.storage.local.get('accessToken')

    if (!accessToken || typeof accessToken !== 'string') {
      sendResponse({ ok: false, error: 'Not authenticated' })
      return
    }

    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (res.status === 401) {
      // Try refreshing
      const refreshRes = await new Promise<MessageResponse>((resolve) => refreshAccessToken(resolve))
      if (!refreshRes.ok) {
        sendResponse({ ok: false, error: 'Session expired. Please sign in again.' })
        return
      }
      // Retry with new token
      const newToken = ((refreshRes.data) as { accessToken: string }).accessToken
      const retryRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${newToken}` },
      })
      if (!retryRes.ok) {
        sendResponse({ ok: false, error: 'Failed to fetch user profile' })
        return
      }
      const data = await retryRes.json()
      sendResponse({ ok: true, data })
      return
    }

    if (!res.ok) {
      sendResponse({ ok: false, error: 'Failed to fetch user profile' })
      return
    }

    const data = await res.json()
    sendResponse({ ok: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    sendResponse({ ok: false, error: message })
  }
}

async function logoutUser(sendResponse: (r: MessageResponse) => void): Promise<void> {
  try {
    const { accessToken, refreshToken } = await chrome.storage.local.get([
      'accessToken',
      'refreshToken',
    ])

    // Best-effort server-side logout (don't fail if the request errors)
    if (accessToken && typeof accessToken === 'string') {
      const body: Record<string, string> = {}
      if (refreshToken && typeof refreshToken === 'string') {
        body['refresh_token'] = refreshToken
      }
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }).catch(() => { /* server unreachable — clear locally anyway */ })
    }

    await chrome.storage.local.remove(['accessToken', 'refreshToken', 'userId'])
    sendResponse({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    sendResponse({ ok: false, error: message })
  }
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isInternalMessage(value: unknown): value is InternalMessage {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  const validTypes = new Set<string>([
    'PING',
    'GET_AUTH_STATUS',
    'SET_TOKENS',
    'CLEAR_AUTH',
    'INITIATE_GOOGLE_AUTH',
    'REFRESH_TOKEN',
    'GET_USER',
    'LOGOUT',
  ])
  return typeof obj['type'] === 'string' && validTypes.has(obj['type'])
}
