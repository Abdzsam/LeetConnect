import { vi } from 'vitest'

// ─── Chrome extension API stub ────────────────────────────────────────────────
// The service worker and extension code access `chrome.*` APIs at module
// evaluation time. This global stub must be installed before any test module
// imports service-worker.ts or other chrome-dependent code.
;(globalThis as unknown as Record<string, unknown>)['chrome'] = {
  runtime: {
    id: 'test-extension-id',
    onInstalled: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
    onMessageExternal: { addListener: vi.fn() },
    sendMessage: vi.fn(),
    OnInstalledReason: { INSTALL: 'install', UPDATE: 'update' },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  identity: {
    getRedirectURL: vi.fn(() => 'https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/'),
    launchWebAuthFlow: vi.fn(),
  },
}
