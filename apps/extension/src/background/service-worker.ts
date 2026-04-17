import { getTokens, setTokens, clearTokens } from "../lib/storage.js";

const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ??
  "http://localhost:3001";

// ── Auth alarm ────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "refresh_token") {
    await tryRefreshToken();
  }
});

async function tryRefreshToken() {
  const tokens = await getTokens();
  if (!tokens) return;

  // Refresh 2 minutes before expiry
  if (tokens.expiresAt - Date.now() > 2 * 60 * 1000) return;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!res.ok) {
      await clearTokens();
      return;
    }

    const data = (await res.json()) as {
      accessToken: string;
      expiresAt: number;
    };

    const updated = {
      ...tokens,
      accessToken: data.accessToken,
      expiresAt: data.expiresAt,
    };
    await setTokens(updated);

    // Notify all content scripts of the new token
    const tabs = await chrome.tabs.query({ url: "https://leetcode.com/*" });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs
          .sendMessage(tab.id, { type: "AUTH_TOKENS", tokens: updated })
          .catch(() => void 0); // tab may not have content script
      }
    }
  } catch {
    // Network error — will retry on next alarm
  }
}

// ── Message handlers ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SIGN_IN") {
    void handleSignIn().then((result) => sendResponse(result));
    return true; // keep channel open for async response
  }

  if (message.type === "SIGN_OUT") {
    void clearTokens().then(() => {
      chrome.alarms.clear("refresh_token");
      sendResponse({ success: true });
    });
    return true;
  }
});

async function handleSignIn(): Promise<{ success: boolean; error?: string }> {
  const redirectUrl = chrome.identity.getRedirectURL("oauth2");
  const authUrl = `${API_URL}/auth/google?redirect_uri=${encodeURIComponent(redirectUrl)}`;

  try {
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    if (!responseUrl) {
      return { success: false, error: "No response URL" };
    }

    // Parse tokens from the URL fragment
    const fragment = new URL(responseUrl).hash.slice(1);
    const tokens = JSON.parse(decodeURIComponent(fragment)) as {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    };

    await setTokens(tokens);

    // Schedule token refresh
    chrome.alarms.create("refresh_token", { periodInMinutes: 1 });

    // Notify all content scripts
    const tabs = await chrome.tabs.query({ url: "https://leetcode.com/*" });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs
          .sendMessage(tab.id, { type: "AUTH_TOKENS", tokens })
          .catch(() => void 0);
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// On install / startup, schedule refresh alarm if we have tokens
chrome.runtime.onInstalled.addListener(async () => {
  const tokens = await getTokens();
  if (tokens) {
    chrome.alarms.create("refresh_token", { periodInMinutes: 1 });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const tokens = await getTokens();
  if (tokens) {
    chrome.alarms.create("refresh_token", { periodInMinutes: 1 });
  }
});
