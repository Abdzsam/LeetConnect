import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'LeetConnect',
  version: '0.1.0',
  description: 'Real-time collaboration panel for LeetCode — chat, presence, and voice with fellow coders.',

  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },

  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'LeetConnect',
    default_icon: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
    },
  },

  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },

  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],

  // Strict CSP — no unsafe-inline, no unsafe-eval
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },

  permissions: ['storage', 'activeTab', 'identity', 'alarms'],

  web_accessible_resources: [
    {
      resources: ['icons/*'],
      matches: ['<all_urls>'],
    },
  ],
})
