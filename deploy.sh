#!/usr/bin/env bash
# LeetConnect — one-shot deploy script
# Usage: ./deploy.sh
# Prerequisites: railway login (run once in terminal), jq

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$ROOT/apps/server"
EXT_DIR="$ROOT/apps/extension"

# ── 1. Deploy server to Railway ───────────────────────────────────────────────
echo "▶ Deploying server to Railway..."
cd "$SERVER_DIR"

# Initialize project if not already linked
if ! railway status &>/dev/null; then
  railway init --name leetconnect-server
fi

# Push all env vars from .env to Railway
echo "  Setting environment variables..."
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  railway variables set "$key=$value" --silent 2>/dev/null || true
done < .env

# Override NODE_ENV for production
railway variables set NODE_ENV=production --silent

# Deploy
railway up --detach
echo "  Waiting for deployment..."
sleep 10

# Get the deployed URL
SERVER_URL=$(railway domain 2>/dev/null | grep -Eo 'https://[^ ]+' | head -1 || echo "")
if [[ -z "$SERVER_URL" ]]; then
  # Try to generate a domain if none exists
  railway domain generate 2>/dev/null || true
  sleep 3
  SERVER_URL=$(railway domain 2>/dev/null | grep -Eo 'https://[^ ]+' | head -1 || echo "")
fi

if [[ -z "$SERVER_URL" ]]; then
  echo "  ⚠ Could not detect Railway URL automatically."
  read -rp "  Enter your Railway server URL (e.g. https://leetconnect-server.up.railway.app): " SERVER_URL
fi

echo "  ✓ Server deployed at $SERVER_URL"

# ── 2. Build extension for production ─────────────────────────────────────────
echo "▶ Building extension..."
cd "$EXT_DIR"
VITE_SERVER_URL="$SERVER_URL" npm run build

# ── 3. Package as zip ─────────────────────────────────────────────────────────
echo "▶ Packaging extension..."
cd "$EXT_DIR/dist"
ZIP_PATH="$ROOT/leetconnect-extension.zip"
rm -f "$ZIP_PATH"
zip -r "$ZIP_PATH" .
echo "  ✓ Packaged → $ZIP_PATH"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  All done!                                                       ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Server:    $SERVER_URL"
echo "║  Extension: $ZIP_PATH"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                                     ║"
echo "║  1. Add $SERVER_URL to Google Cloud Console CORS origins        ║"
echo "║  2. Upload leetconnect-extension.zip to Chrome Web Store        ║"
echo "║     https://chrome.google.com/webstore/devconsole               ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
