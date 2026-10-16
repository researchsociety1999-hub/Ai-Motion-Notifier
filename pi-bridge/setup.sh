#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo " 🚀 Ring Motion AI Bridge — 1-Click Setup"
echo "=========================================="
echo ""

# 1. Create .env if missing
if [ ! -f .env ]; then
  echo "📄 Creating .env from defaults..."
  cp .env.example .env
fi

# 2. Check for Ring refresh token
CURRENT_TOKEN=$(grep -E "^RINGTOKEN=" .env | cut -d '=' -f2- | tr -d ' ' || true)

if [ -z "$CURRENT_TOKEN" ] || [ "$CURRENT_TOKEN" = "your_ring_refresh_token_here" ]; then
  echo "🔐 Ring Authentication Required (One-Time Setup)"
  echo "   Enter your Ring email, password, and 2FA code below."
  echo ""
  
  # Run auth CLI in docker
  TOKEN=$(docker run -it --rm --entrypoint /app/ring-mqtt/node_modules/ring-client-api/ring-auth-cli.js tsightler/ring-mqtt 2>/dev/null | grep -E "^ey[A-Za-z0-9_-]+" || true)
  
  if [ -z "$TOKEN" ]; then
    echo "⚠️  Could not auto-capture token. Please run:"
    echo "   docker run -it --rm --entrypoint /app/ring-mqtt/node_modules/ring-client-api/ring-auth-cli.js tsightler/ring-mqtt"
    echo "   and paste the token into pi-bridge/.env under RINGTOKEN="
    exit 1
  fi

  # Write token to .env
  if grep -q "^RINGTOKEN=" .env; then
    sed -i.bak "s|^RINGTOKEN=.*|RINGTOKEN=${TOKEN}|" .env && rm -f .env.bak
  else
    echo "RINGTOKEN=${TOKEN}" >> .env
  fi
  echo "✅ Token saved to .env"
  echo ""
fi

# 3. Create recordings directory
mkdir -p recordings

# 4. Build and start containers
echo "📦 Building and starting Docker containers..."
docker compose up -d --build

echo ""
echo "=========================================="
echo " 🎉 System is RUNNING!"
echo "=========================================="
echo " • Local clips will save to: pi-bridge/recordings/"
echo " • Live logs command:       cd pi-bridge && docker compose logs -f ring-ai-bridge"
echo " • Stop command:            cd pi-bridge && docker compose down"
echo ""
echo "Walk in front of your camera to trigger your first test clip & AI alert!"
