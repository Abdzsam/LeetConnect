/**
 * MV3 Service Worker — LeetConnect background script.
 *
 * Security principles enforced here:
 *   - All chrome.runtime.onMessage listeners validate the sender's extension ID
 *     against chrome.runtime.id before acting on any message.
 *   - External messages (onMessageExternal) are rejected by default.
 *   - No eval(), no Function(), no dynamic code execution.
 *   - Storage writes are validated before persisting.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type InternalMessage =
  | { type: 'GET_AUTH_STATUS' }
  | { type: 'SET_AUTH_TOKEN'; token: string }
  | { type: 'CLEAR_AUTH' }
  | { type: 'PING' }

type MessageResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string }

// ─── Lifecycle ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.info('[LeetConnect] Extension installed.')
    // Initialise default storage values
    chrome.storage.local.set({
      authToken: null,
      userId: null,
      installedAt: Date.now(),
    }).catch((err: unknown) => {
      console.error('[LeetConnect] Failed to initialise storage:', err)
    })
  }

  if (reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.info('[LeetConnect] Extension updated.')
  }
})

// ─── Internal message handler ─────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ): boolean => {
    // ── Validate sender ──────────────────────────────────────────────────────
    // Only accept messages from our own extension (content scripts, popup).
    // Reject anything from web pages or other extensions.
    if (sender.id !== chrome.runtime.id) {
      sendResponse({ ok: false, error: 'Unauthorized sender' })
      return false
    }

    // Reject messages that arrive from a tab URL that is external
    // (content scripts have sender.tab; popup does not — both are fine)
    if (sender.url && !sender.url.startsWith('chrome-extension://')) {
      sendResponse({ ok: false, error: 'Untrusted sender URL' })
      return false
    }

    // ── Type-check message ────────────────────────────────────────────────────
    if (!isInternalMessage(message)) {
      sendResponse({ ok: false, error: 'Unknown message type' })
      return false
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────
    handleMessage(message, sendResponse)

    // Return true to indicate we will call sendResponse asynchronously
    return true
  },
)

// ─── Reject all external messages ─────────────────────────────────────────────

chrome.runtime.onMessageExternal.addListener(
  (
    _message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ) => {
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
        .get(['authToken', 'userId'])
        .then((result) => {
          sendResponse({
            ok: true,
            data: {
              authenticated: Boolean(result['authToken']),
              userId: result['userId'] ?? null,
            },
          })
        })
        .catch((err: unknown) => {
          console.error('[LeetConnect] Storage read error:', err)
          sendResponse({ ok: false, error: 'Storage error' })
        })
      break
    }

    case 'SET_AUTH_TOKEN': {
      // Validate token before storing — must be a non-empty string
      const token = message.token
      if (typeof token !== 'string' || token.trim().length === 0) {
        sendResponse({ ok: false, error: 'Invalid token' })
        break
      }
      // Sanitise: only accept tokens that look like JWTs (three base64url segments)
      const JWT_PATTERN = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/
      if (!JWT_PATTERN.test(token)) {
        sendResponse({ ok: false, error: 'Token format invalid' })
        break
      }
      chrome.storage.local
        .set({ authToken: token })
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) => {
          console.error('[LeetConnect] Storage write error:', err)
          sendResponse({ ok: false, error: 'Storage error' })
        })
      break
    }

    case 'CLEAR_AUTH': {
      chrome.storage.local
        .remove(['authToken', 'userId'])
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) => {
          console.error('[LeetConnect] Storage clear error:', err)
          sendResponse({ ok: false, error: 'Storage error' })
        })
      break
    }

    default: {
      // Exhaustiveness check — TypeScript will warn if a case is missing
      const _exhaustive: never = message
      void _exhaustive
      sendResponse({ ok: false, error: 'Unhandled message type' })
    }
  }
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isInternalMessage(value: unknown): value is InternalMessage {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  const validTypes = new Set<string>([
    'GET_AUTH_STATUS',
    'SET_AUTH_TOKEN',
    'CLEAR_AUTH',
    'PING',
  ])
  return typeof obj['type'] === 'string' && validTypes.has(obj['type'])
}
