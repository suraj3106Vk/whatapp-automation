#!/data/data/com.termux/files/usr/bin/bash
# ── SK Agent — Termux one-shot launcher ─────────────────────────────────────
# Usage (from ~/whatapp-automation):
#   bash termux-start.sh
#
# What it does:
#   1. Kills any old backend or tunnel still on port 3001
#   2. Installs/updates npm deps (silently)
#   3. Starts the backend in background
#   4. Waits for port 3001 to be ready
#   5. Starts cloudflared tunnel (http2 — no QUIC timeouts on mobile)
#   6. Waits and prints your live HTTPS tunnel URL
#   7. Prints "Update VITE_API_URL in Netlify to: <url>"

set -e

BACKEND_DIR="$HOME/whatapp-automation/backend"
LOG_FILE="$HOME/cf-tunnel.log"
NODE_LOG="$HOME/sk-backend.log"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║         SK Agent — Termux Launcher           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Kill any existing backend on port 3001 ────────────────────────────
echo "→ Cleaning up old processes..."
pkill -f "node src/index.js" 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

# ── Step 2: Install deps ──────────────────────────────────────────────────────
echo "→ Installing dependencies..."
cd "$BACKEND_DIR"
npm install --omit=dev --silent 2>/dev/null || npm install --omit=dev

# ── Step 3: Start backend ─────────────────────────────────────────────────────
echo "→ Starting SK Agent backend..."
nohup node src/index.js > "$NODE_LOG" 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# ── Step 4: Wait for port 3001 to open ───────────────────────────────────────
echo "→ Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if nc -z 127.0.0.1 3001 2>/dev/null; then
    echo "  Backend ready (${i}s)"
    break
  fi
  sleep 1
  if [ $i -eq 30 ]; then
    echo "  ERROR: Backend didn't start in 30s. Check logs:"
    echo "  tail -30 $NODE_LOG"
    tail -20 "$NODE_LOG"
    exit 1
  fi
done

# ── Step 5: Start cloudflared (http2 — stable on mobile) ────────────────────
echo "→ Starting Cloudflare tunnel (http2 mode)..."
rm -f "$LOG_FILE"
nohup cloudflared tunnel --url http://127.0.0.1:3001 --protocol http2 > "$LOG_FILE" 2>&1 &
TUNNEL_PID=$!

# ── Step 6: Extract tunnel URL ───────────────────────────────────────────────
echo "→ Waiting for tunnel URL..."
TUNNEL_URL=""
for i in $(seq 1 30); do
  sleep 1
  TUNNEL_URL=$(grep -m1 'trycloudflare.com' "$LOG_FILE" 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' || true)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
done

# ── Step 7: Print results ─────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
if [ -n "$TUNNEL_URL" ]; then
echo "║  ✅  SK AGENT IS LIVE                                        ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf  "║  🌐  URL: %-50s ║\n" "$TUNNEL_URL"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  📋  Next step:                                              ║"
echo "║  1. Open: frontend/.env.production (on your PC)             ║"
echo "║  2. Set:  VITE_API_URL=$TUNNEL_URL"
echo "║  3. Git push → Netlify auto-redeploys                       ║"
else
echo "║  ⚠️  Tunnel URL not detected yet — check log:               ║"
printf  "║  tail -20 %-49s ║\n" "$LOG_FILE"
fi
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  📄  Backend log:  tail -f ~/sk-backend.log                 ║"
echo "║  📄  Tunnel log:   tail -f ~/cf-tunnel.log                  ║"
echo "║  🛑  Stop all:     pkill -f 'node src'; pkill -f cloudflared║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Save URL to file for easy copy
if [ -n "$TUNNEL_URL" ]; then
  echo "$TUNNEL_URL" > "$HOME/sk-tunnel-url.txt"
  echo "  URL also saved to: ~/sk-tunnel-url.txt"
  echo "  cat ~/sk-tunnel-url.txt"
fi
echo ""
