import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Discord-inspired dark theme
        lc: {
          bg: "#1e1f22",
          sidebar: "#2b2d31",
          channel: "#313338",
          input: "#383a40",
          accent: "#ffa116", // LeetCode orange
          "accent-hover": "#ffb347",
          online: "#23a55a",
          idle: "#f0b132",
          muted: "#b5bac1",
          text: "#dbdee1",
          "text-muted": "#949ba4",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
