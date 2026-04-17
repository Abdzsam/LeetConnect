interface AuthGateProps {
  onSignIn: () => void;
}

export function AuthGate({ onSignIn }: AuthGateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-lc-accent/10 border border-lc-accent/20 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M17 8C17 10.7614 14.7614 13 12 13C9.23858 13 7 10.7614 7 8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8Z" fill="#ffa116" opacity="0.8"/>
          <path d="M3 21C3 17.134 7.02944 14 12 14C16.9706 14 21 17.134 21 21" stroke="#ffa116" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      <div>
        <h2 className="text-lc-text font-bold text-base mb-1">Welcome to LeetConnect</h2>
        <p className="text-lc-text-muted text-xs leading-relaxed">
          Chat and code with everyone on this problem. Sign in to join the room.
        </p>
      </div>

      <button
        onClick={onSignIn}
        className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-gray-100 text-gray-800 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 48 48">
          <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
          <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.0 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
          <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
          <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
        </svg>
        Continue with Google
      </button>
    </div>
  );
}
