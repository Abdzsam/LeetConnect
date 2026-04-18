import { defineManifest } from '@crxjs/vite-plugin'

const serverUrl = process.env['VITE_SERVER_URL'] ?? 'http://localhost:3000'
const serverOrigin = new URL(serverUrl).origin

export default defineManifest({
  manifest_version: 3,
  name: 'LeetConnect',
  version: '0.1.0',
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyHV1xya2Mu7tNalQZgA4qlRt0CFa+F1O7XWIQdhBw8l5iNOZVOspOBYFLGs+FbbGfhNMM0U++ZybcQafX4nl9Qai1zSMiPPF9rEXbN4ke6gxkZpuH7FI0zGfVEgb6yDfbiL9ivLMcQwHa/ZBH+2tVE5GkxKs8gFRdHr9/eBW84hFNC1yg123Cia4ySfUtsfxNm+XjkpdUzU75bYXjOVCunKnia+frBUnF3bU8rYkUa5Dmg9h+exICWSIU00X5XbunSHQ13wOjOTtx0qhuokzqekX2F6dAKxqrATlBqJU5YHvAs2VnKASAS9/+LHD4RnpzPaXLNmdO+GJiXPW5z/3sQIDAQAB',
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

  permissions: ['storage', 'activeTab', 'identity', 'alarms', 'webNavigation'],

  host_permissions: [`${serverOrigin}/*`],

  web_accessible_resources: [
    {
      resources: ['icons/*'],
      matches: ['<all_urls>'],
    },
  ],
})
