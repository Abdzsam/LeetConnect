/**
 * Content script entry point.
 *
 * Mounts the LeetConnect sliding panel into a Shadow DOM so that:
 *   1. Page styles cannot bleed into the extension UI
 *   2. Extension styles cannot accidentally override page styles
 *   3. User data rendered in the panel is always escaped by React (no innerHTML)
 *
 * Security notes:
 *   - Shadow DOM provides hard style encapsulation
 *   - Tailwind CSS is injected as a compiled stylesheet string (?inline) —
 *     no runtime eval, no unsafe-inline script
 *   - chrome.runtime messages validated in the service worker; this script
 *     only renders UI and does not accept postMessage from the page
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import { SlidingPanel } from './SlidingPanel'

// Import compiled Tailwind CSS as a plain string so we can inject it into the
// shadow root without needing unsafe-inline in CSP.
// Vite's ?inline suffix returns the file contents as a JS string.
import tailwindStyles from '../styles/globals.css?inline'

function mount(): void {
  // Prevent double-mounting (e.g., if the content script fires twice)
  const MOUNT_ID = 'leetconnect-root'
  if (document.getElementById(MOUNT_ID)) return

  // ── Create shadow host ─────────────────────────────────────────────────────
  // `pointer-events: none` lets the page underneath receive clicks normally.
  // Individual interactive elements inside set `pointer-events: auto`.
  const host = document.createElement('div')
  host.id = MOUNT_ID

  // Apply host styles via setAttribute to avoid any CSP string-eval risk
  host.setAttribute(
    'style',
    [
      'all: initial',
      'position: fixed',
      'top: 0',
      'right: 0',
      'height: 100vh',
      'width: 0',           // zero width so the host itself takes no space
      'z-index: 2147483647',
      'pointer-events: none',
    ].join('; '),
  )

  // ── Attach shadow root ─────────────────────────────────────────────────────
  const shadowRoot = host.attachShadow({ mode: 'closed' })
  //                                              ^^^^^^
  // 'closed' prevents untrusted page JS from accessing shadowRoot via
  // element.shadowRoot — an extra layer of defence against XSS attempts
  // on the host page trying to tamper with our UI.

  // ── Inject Tailwind stylesheet into shadow root ────────────────────────────
  // The CSS string is the compiled output from postcss/tailwind — no eval,
  // no inline script. This satisfies the strict CSP.
  const styleEl = document.createElement('style')
  styleEl.textContent = tailwindStyles   // .textContent, never .innerHTML
  shadowRoot.appendChild(styleEl)

  // ── Mount React into shadow root ───────────────────────────────────────────
  const reactRoot = document.createElement('div')
  reactRoot.id = 'leetconnect-react-root'
  shadowRoot.appendChild(reactRoot)

  document.documentElement.appendChild(host)

  // React renders into the shadow DOM — all user-facing text goes through
  // React's built-in escaping (no dangerouslySetInnerHTML anywhere).
  const root = createRoot(reactRoot)
  root.render(
    <React.StrictMode>
      <SlidingPanel />
    </React.StrictMode>,
  )
}

// Run after DOM is available
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
