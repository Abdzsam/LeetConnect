import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config.js";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: "es2022",
    sourcemap: true,
  },
  define: {
    "process.env.VITE_API_URL": JSON.stringify(
      process.env["VITE_API_URL"] ?? "http://localhost:3001"
    ),
    "process.env.VITE_SOCKET_URL": JSON.stringify(
      process.env["VITE_SOCKET_URL"] ?? "ws://localhost:3001"
    ),
  },
});
