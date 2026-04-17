import { useEffect, useState } from "react";
import { getTokens, clearTokens, setTokens } from "../lib/storage.js";
import type { StoredTokens } from "../lib/storage.js";
import { initSockets, disconnectSockets } from "../lib/socket.js";
import type { User } from "@leetconnect/types";

const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ??
  "http://localhost:3001";

interface AuthState {
  user: User | null;
  tokens: StoredTokens | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokensState] = useState<StoredTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadAuth();

    // Listen for token updates from service worker
    const handler = (
      message: { type: string; tokens?: StoredTokens },
    ) => {
      if (message.type === "AUTH_TOKENS" && message.tokens) {
        void handleTokens(message.tokens);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  async function loadAuth() {
    setIsLoading(true);
    const stored = await getTokens();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    await handleTokens(stored);
    setIsLoading(false);
  }

  async function handleTokens(storedTokens: StoredTokens) {
    setTokensState(storedTokens);
    await setTokens(storedTokens);
    initSockets(storedTokens.accessToken);

    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${storedTokens.accessToken}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { user: User };
        setUser(data.user);
      } else {
        signOut();
      }
    } catch {
      // Network error — keep existing user state
    }
  }

  async function signIn() {
    try {
      const result = await chrome.runtime.sendMessage({ type: "SIGN_IN" }) as
        | { success: boolean; error?: string }
        | undefined;
      if (result?.success) {
        // Tokens are now in storage — reload auth state
        await loadAuth();
      } else if (result?.error) {
        console.error("[LeetConnect] Sign in failed:", result.error);
      }
    } catch (err) {
      console.error("[LeetConnect] Sign in error:", err);
    }
  }

  function signOut() {
    void clearTokens();
    disconnectSockets();
    setUser(null);
    setTokensState(null);
  }

  return { user, tokens, isLoading, signIn, signOut };
}
