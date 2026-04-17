/** Type-safe wrappers around chrome.storage.local */

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

const TOKENS_KEY = "lc_tokens";

export async function getTokens(): Promise<StoredTokens | null> {
  const result = await chrome.storage.local.get(TOKENS_KEY);
  return (result[TOKENS_KEY] as StoredTokens | undefined) ?? null;
}

export async function setTokens(tokens: StoredTokens): Promise<void> {
  await chrome.storage.local.set({ [TOKENS_KEY]: tokens });
}

export async function clearTokens(): Promise<void> {
  await chrome.storage.local.remove(TOKENS_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens) return null;

  // If access token expires within 60 seconds, try refreshing
  if (tokens.expiresAt - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    if (refreshed) return refreshed;
    return null;
  }

  return tokens.accessToken;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const apiUrl = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001";
  try {
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const data = (await res.json()) as {
      accessToken: string;
      expiresAt: number;
    };
    const tokens = await getTokens();
    if (tokens) {
      await setTokens({ ...tokens, accessToken: data.accessToken, expiresAt: data.expiresAt });
    }
    return data.accessToken;
  } catch {
    return null;
  }
}
