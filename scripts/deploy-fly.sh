#!/bin/bash
# Ring AI Motion Notifier — Fly.io Deploy Script
# Run this once to set up and deploy your app on Fly.io

set -e

echo "=== Ring AI Motion Notifier — Fly.io Setup ==="

# 1. Check flyctl is installed
if ! command -v flyctl &> /dev/null; then
  echo "Installing flyctl..."
  curl -L https://fly.io/install.sh | sh
  export FLYCTL_INSTALL="$HOME/.fly"
  export PATH="$FLYCTL_INSTALL/bin:$PATH"
fi

# 2. Login
echo "\n[1/6] Logging in to Fly.io..."
flyctl auth login

# 3. Create the app (only first time)
echo "\n[2/6] Creating app on Fly.io..."
flyctl apps create ring-ai-motion-notifier --org personal || echo "App may already exist, continuing..."

# 4. Create a Postgres database
echo "\n[3/6] Creating PostgreSQL database..."
flyctl postgres create \
  --name ring-notifier-db \
  --region iad \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1 || echo "DB may already exist, continuing..."

# 5. Attach Postgres to the app (auto-sets DATABASE_URL secret)
echo "\n[4/6] Attaching database to app..."
flyctl postgres attach ring-notifier-db --app ring-ai-motion-notifier || echo "Already attached, continuing..."

# 6. Set all required secrets
echo "\n[5/6] Setting environment secrets..."
echo "You will be prompted to enter each secret value."

read -p "ADMIN_SECRET_KEY (generate with: openssl rand -hex 32): " ADMIN_SECRET_KEY
read -p "RING_CLIENT_ID: " RING_CLIENT_ID
read -p "RING_CLIENT_SECRET: " RING_CLIENT_SECRET
read -p "RING_HMAC_KEY: " RING_HMAC_KEY
read -p "AWS_ACCESS_KEY_ID: " AWS_ACCESS_KEY_ID
read -p "AWS_SECRET_ACCESS_KEY: " AWS_SECRET_ACCESS_KEY
read -p "AWS_REGION (e.g. us-east-1): " AWS_REGION
read -p "S3_BUCKET_NAME: " S3_BUCKET_NAME
read -p "FIREBASE_PROJECT_ID: " FIREBASE_PROJECT_ID
read -p "FIREBASE_CLIENT_EMAIL: " FIREBASE_CLIENT_EMAIL
read -p "FIREBASE_PRIVATE_KEY: " FIREBASE_PRIVATE_KEY
read -p "OPENAI_API_KEY (optional, press Enter to skip): " OPENAI_API_KEY

flyctl secrets set \
  ADMIN_SECRET_KEY="$ADMIN_SECRET_KEY" \
  RING_CLIENT_ID="$RING_CLIENT_ID" \
  RING_CLIENT_SECRET="$RING_CLIENT_SECRET" \
  RING_HMAC_KEY="$RING_HMAC_KEY" \
  RING_OAUTH_URL="https://oauth.ring.com/oauth/token" \
  RING_API_BASE="https://api.amazonvision.com" \
  AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  AWS_REGION="$AWS_REGION" \
  S3_BUCKET_NAME="$S3_BUCKET_NAME" \
  FIREBASE_PROJECT_ID="$FIREBASE_PROJECT_ID" \
  FIREBASE_CLIENT_EMAIL="$FIREBASE_CLIENT_EMAIL" \
  FIREBASE_PRIVATE_KEY="$FIREBASE_PRIVATE_KEY" \
  ${OPENAI_API_KEY:+OPENAI_API_KEY="$OPENAI_API_KEY"} \
  --app ring-ai-motion-notifier

# 7. Deploy
echo "\n[6/6] Deploying..."
flyctl deploy --app ring-ai-motion-notifier

# 8. Run DB schema
echo "\n=== Running database schema ==="
flyctl ssh console --app ring-ai-motion-notifier -C \
  "psql \$DATABASE_URL -f /app/src/db/schema.sql"

# 9. Print app URL
APP_URL=$(flyctl info --app ring-ai-motion-notifier -j | grep -o '"hostname":"[^"]*"' | cut -d'"' -f4)
echo ""
echo "=== ✅ Deployment complete! ==="
echo "App URL:      https://$APP_URL"
echo "Health check: https://$APP_URL/health"
echo ""
echo "Next steps:"
echo "1. Register your Webhook URL in Ring Developer Portal:"
echo "   https://$APP_URL/webhooks/ring"
echo "2. Link your Ring account:"
echo "   curl https://$APP_URL/oauth/link -H \"x-admin-key: $ADMIN_SECRET_KEY\""
echo "3. Sync your devices:"
echo "   curl https://$APP_URL/devices -H \"x-admin-key: $ADMIN_SECRET_KEY\""
