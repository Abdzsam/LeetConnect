/** Detects the current LeetCode problem slug and fires callbacks on change.
 *  LeetCode is a React SPA — standard navigation events don't fire on route
 *  changes, so we monkey-patch history methods and use a MutationObserver
 *  as a fallback.
 */

type SlugChangeCallback = (
  newSlug: string | null,
  prevSlug: string | null
) => void;

const PROBLEM_SLUG_RE = /\/problems\/([^/?#]+)/;

function extractSlug(pathname: string): string | null {
  const match = PROBLEM_SLUG_RE.exec(pathname);
  return match?.[1] ?? null;
}

let currentSlug: string | null = extractSlug(location.pathname);
const listeners: SlugChangeCallback[] = [];

function notify(newSlug: string | null, prevSlug: string | null): void {
  for (const cb of listeners) {
    try {
      cb(newSlug, prevSlug);
    } catch (e) {
      console.error("[LeetConnect] slug change handler error", e);
    }
  }
}

function handlePathChange(): void {
  const newSlug = extractSlug(location.pathname);
  if (newSlug !== currentSlug) {
    const prev = currentSlug;
    currentSlug = newSlug;
    notify(newSlug, prev);
  }
}

// Monkey-patch history to catch SPA navigation
const originalPushState = history.pushState.bind(history);
const originalReplaceState = history.replaceState.bind(history);

history.pushState = function (...args) {
  originalPushState(...args);
  handlePathChange();
};

history.replaceState = function (...args) {
  originalReplaceState(...args);
  handlePathChange();
};

window.addEventListener("popstate", handlePathChange);

// MutationObserver on <title> as secondary trigger
const titleObserver = new MutationObserver(() => handlePathChange());
const titleEl = document.querySelector("title");
if (titleEl) {
  titleObserver.observe(titleEl, { childList: true });
} else {
  // Wait for <title> to appear
  const headObserver = new MutationObserver(() => {
    const t = document.querySelector("title");
    if (t) {
      titleObserver.observe(t, { childList: true });
      headObserver.disconnect();
    }
  });
  headObserver.observe(document.head, { childList: true });
}

export function onSlugChange(cb: SlugChangeCallback): () => void {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function getCurrentSlug(): string | null {
  return currentSlug;
}
