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

# Link project if not already linked
if ! railway status &>/dev/null; then
  railway init --name leetconnect-server
fi

# Step 1: Create the service by deploying (service named "server" is created on first up)
echo "  Creating service and uploading code..."
railway up --detach --service server
echo "  Waiting for service to register..."
sleep 8

# Step 2: Set env vars — Railway will auto-redeploy the service
echo "  Setting environment variables (will trigger redeploy)..."
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  railway variable --service server set "$key=$value" --skip-deploys 2>/dev/null || true
done < .env
# Final var without --skip-deploys so Railway triggers a redeploy with all vars set
railway variable --service server set NODE_ENV=production

echo "  Waiting for redeploy to start..."
sleep 20

# Generate a domain if none exists, then grab it
railway domain --service server 2>/dev/null || true
sleep 3
SERVER_URL=$(railway domain --service server --json 2>/dev/null | grep -Eo '"domain":"[^"]+"' | head -1 | cut -d'"' -f4 || echo "")
[[ -n "$SERVER_URL" ]] && SERVER_URL="https://$SERVER_URL"

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
