/**
 * MV3 Service Worker — LeetConnect background script.
 *
 * OAuth flow:
 *   1. Get chromiumapp.org redirect URI via chrome.identity.getRedirectURL()
 *   2. Fetch a signed auth URL from the server (server stores PKCE state)
 *   3. Call chrome.identity.launchWebAuthFlow — Google redirects back to chromiumapp.org
 *   4. Extract code + state from the returned URL
 *   5. POST code + state to server /auth/google/exchange → receive JWT + refresh token
 *
 * Security:
 *   - All chrome.runtime.onMessage listeners validate the sender's extension ID.
 *   - External messages (onMessageExternal) are rejected by default.
 *   - No eval(), no Function(), no dynamic code execution.
 *   - Storage writes validate format before persisting.
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
      void initiateGoogleAuth(sendResponse)
      break
    }

    case 'REFRESH_TOKEN': {
      void refreshAccessToken(sendResponse)
      break
    }

    case 'GET_USER': {
      void getUserProfile(sendResponse)
      break
    }

    case 'LOGOUT': {
      void logoutUser(sendResponse)
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
  // Keep the service worker alive — MV3 workers can be killed after ~30s of inactivity.
  const KEEPALIVE_ALARM = 'lc-auth-keepalive'
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.4 })

  try {
    // The chromiumapp.org URL must be registered as an Authorized Redirect URI in Google Cloud Console.
    const extRedirectUri = chrome.identity.getRedirectURL()

    const initRes = await fetch(
      `${API_BASE}/auth/google/init?ext_redirect_uri=${encodeURIComponent(extRedirectUri)}`,
    )
    if (!initRes.ok) {
      const err = (await initRes.json()) as { error?: string }
      sendResponse({ ok: false, error: err.error ?? 'Failed to init auth' })
      return
    }
    const { authUrl } = (await initRes.json()) as { authUrl: string }

    // Try the popup flow first (works when triggered from the extension popup page).
    // Chrome silently returns null when launchWebAuthFlow is called without a user
    // gesture in an extension page context — this happens when the trigger is a
    // content script (the side panel).
    let resultUrl: string | null = null
    try {
      resultUrl = (await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true })) ?? null
    } catch { /* falls through to tab-based flow */ }

    if (resultUrl) {
      await exchangeAndStore(resultUrl, sendResponse)
      return
    }

    // Tab-based fallback for content-script context: open the auth URL in a real tab.
    // chrome.webNavigation intercepts when Google redirects back to chromiumapp.org.
    // Signal the UI to poll rather than wait on this response.
    sendResponse({ ok: true, data: { pending: true } })

    const tab = await chrome.tabs.create({ url: authUrl })

    await new Promise<void>((resolve) => {
      const onNav = (details: chrome.webNavigation.WebNavigationParentedCallbackDetails) => {
        if (details.tabId !== tab.id) return
        try {
          const redirected = new URL(details.url)
          if (!redirected.hostname.endsWith('.chromiumapp.org')) return
        } catch { return }

        chrome.webNavigation.onBeforeNavigate.removeListener(onNav)
        chrome.tabs.remove(details.tabId).catch(() => { /* tab may already be closing */ })

        void (async () => {
          // Exchange code silently — storage change will wake the polling UI.
          const code = new URL(details.url).searchParams.get('code')
          const state = new URL(details.url).searchParams.get('state')
          if (code && state) {
            await exchangeAndStore(details.url, () => { /* sendResponse already sent */ })
          }
          resolve()
        })()
      }

      chrome.webNavigation.onBeforeNavigate.addListener(onNav)

      // Safety timeout: 10 minutes, then clean up.
      setTimeout(() => {
        chrome.webNavigation.onBeforeNavigate.removeListener(onNav)
        chrome.tabs.remove(tab.id ?? -1).catch(() => { /* ignore */ })
        resolve()
      }, 10 * 60 * 1000)
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    sendResponse({ ok: false, error: msg })
  } finally {
    chrome.alarms.clear(KEEPALIVE_ALARM)
  }
}

async function exchangeAndStore(
  resultUrl: string,
  sendResponse: (r: MessageResponse) => void,
): Promise<void> {
  const url = new URL(resultUrl)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    sendResponse({ ok: false, error: 'Missing code or state in OAuth response' })
    return
  }

  const exchangeRes = await fetch(`${API_BASE}/auth/google/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  })

  if (!exchangeRes.ok) {
    const err = (await exchangeRes.json()) as { error?: string }
    sendResponse({ ok: false, error: err.error ?? 'Token exchange failed' })
    return
  }

  const tokens = (await exchangeRes.json()) as { access_token: string; refresh_token: string }

  if (!JWT_PATTERN.test(tokens.access_token)) {
    sendResponse({ ok: false, error: 'Malformed access token received' })
    return
  }

  let userId: string | null = null
  try {
    const payloadB64 = tokens.access_token.split('.')[1]
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
    if (typeof payload['sub'] === 'string') userId = payload['sub']
  } catch { /* leave null */ }

  await chrome.storage.local.set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, userId })
  sendResponse({ ok: true, data: { userId } })
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
      const refreshRes = await new Promise<MessageResponse>((resolve) => void refreshAccessToken(resolve))
      if (!refreshRes.ok) {
        sendResponse({ ok: false, error: 'Session expired. Please sign in again.' })
        return
      }
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

export function isInternalMessage(value: unknown): value is InternalMessage {
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
