import { useEffect, useState } from "react";
import { getTokens, clearTokens } from "../lib/storage.js";
import type { StoredTokens } from "../lib/storage.js";
import type { User } from "@leetconnect/types";

const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ??
  "http://localhost:3001";

export function Popup() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokens, setTokensState] = useState<StoredTokens | null>(null);

  useEffect(() => {
    void loadUser();
  }, []);

  async function loadUser() {
    setIsLoading(true);
    const stored = await getTokens();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setTokensState(stored);
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${stored.accessToken}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { user: User };
        setUser(data.user);
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  }

  async function signIn() {
    chrome.runtime.sendMessage({ type: "SIGN_IN" }, () => {
      void loadUser();
    });
  }

  async function signOut() {
    await clearTokens();
    chrome.runtime.sendMessage({ type: "SIGN_OUT" });
    setUser(null);
    setTokensState(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-orange-400 font-bold text-base">🔗 LeetConnect</span>
      </div>

      {user ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-9 h-9 rounded-full"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-orange-400 flex items-center justify-center text-black font-bold">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-white">{user.displayName}</p>
              {user.leetcodeHandle && (
                <p className="text-xs text-gray-400">@{user.leetcodeHandle}</p>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Visit a LeetCode problem to connect with others.
          </p>

          <button
            onClick={() => void signOut()}
            className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 text-center">
            Sign in to connect with others solving the same LeetCode problems.
          </p>
          <button
            onClick={() => void signIn()}
            className="w-full flex items-center justify-center gap-2 bg-orange-400 hover:bg-orange-500 text-black font-semibold px-4 py-2 rounded-md text-sm transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      )}
    </div>
  );
}
