import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "LeetConnect",
  version: "0.1.0",
  description:
    "Connect with other LeetCode users on the same problem — chat, voice, and video.",
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
    },
  },
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://leetcode.com/problems/*"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage", "identity", "alarms", "notifications"],
  host_permissions: [
    "https://leetcode.com/problems/*",
    "http://localhost:3001/*",
    "https://api.leetconnect.dev/*",
  ],
  web_accessible_resources: [
    {
      resources: ["assets/*"],
      matches: ["https://leetcode.com/*"],
    },
  ],
});
