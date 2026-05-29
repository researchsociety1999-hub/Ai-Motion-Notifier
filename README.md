# AI Motion Notifier

A production-ready Node.js/Express backend that listens for camera motion events via webhooks, downloads the video clip, generates an AI summary, and sends a push notification — all automatically.

## Features
- ✅ OAuth 2.0 Ring account linking
- ✅ HMAC-SHA256 verified webhook ingestion
- ✅ Automatic video clip download from Ring Media API
- ✅ AI-powered event summaries via OpenAI (with graceful fallback)
- ✅ Push notifications via Firebase Cloud Messaging (FCM)
- ✅ Token refresh background job (every 24h)
- ✅ Admin route protection via secret key header
- ✅ Rate limiting on all routes
- ✅ Security headers via Helmet
- ✅ Global error handler
- ✅ Fly.io one-command deploy (with interactive setup script)

## Stack
- **Runtime:** Node.js 20 (Alpine Docker)
- **Framework:** Express
- **Database:** PostgreSQL (via `pg`)
- **Storage:** AWS S3
- **Push notifications:** Firebase Admin SDK (FCM)
- **AI summaries:** OpenAI GPT-4o-mini (optional)
- **Scheduler:** node-cron
- **Security:** Helmet, express-rate-limit, HMAC verification
- **Deploy:** Fly.io

## Project Structure
```
ring-ai-motion-notifier/
├── src/
│   ├── server.js               # Express app entry point
│   ├── routes/
│   │   ├── oauth.js            # Ring OAuth token exchange + account linking
│   │   ├── webhook.js          # Webhook receiver + HMAC verification
│   │   └── devices.js          # Device sync and listing
│   ├── services/
│   │   ├── ringApi.js          # Ring API calls (devices, clips)
│   │   ├── storage.js          # AWS S3 clip upload
│   │   ├── notify.js           # FCM push notification sender
│   │   ├── aiSummary.js        # OpenAI event summary generator
│   │   └── tokenManager.js     # Token refresh + background job
│   ├── db/
│   │   ├── index.js            # pg pool setup
│   │   └── schema.sql          # DB schema
│   └── middleware/
│       ├── verifyHmac.js       # HMAC-SHA256 signature check
│       ├── requireSecret.js    # Admin route protection
│       ├── rateLimiter.js      # Rate limiting
│       └── errorHandler.js     # Global error handler
├── Dockerfile                  # Production Docker image
├── fly.toml                    # Fly.io app config
├── scripts/deploy-fly.sh       # One-command Fly.io setup + deploy
├── .dockerignore
├── .env.example
├── package.json
└── README.md
```

## Deploy to Fly.io (Recommended)

### Option A — Automated (one command)
```bash
git clone https://github.com/researchsociety1999-hub/ring-ai-motion-notifier
cd ring-ai-motion-notifier
chmod +x scripts/deploy-fly.sh
./scripts/deploy-fly.sh
```
The script will:
- Install `flyctl` if not present
- Create the app and PostgreSQL database on Fly.io
- Prompt you for all secrets interactively
- Deploy the Docker container
- Run the DB schema automatically
- Print your live URL and next steps

### Option B — Manual

```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Login
flyctl auth login

# 3. Create app
flyctl apps create ring-ai-motion-notifier

# 4. Create and attach PostgreSQL
flyctl postgres create --name ring-notifier-db --region iad
flyctl postgres attach ring-notifier-db --app ring-ai-motion-notifier

# 5. Set secrets
flyctl secrets set \
  ADMIN_SECRET_KEY=your_secret \
  RING_CLIENT_ID=xxx \
  RING_CLIENT_SECRET=xxx \
  RING_HMAC_KEY=xxx \
  RING_OAUTH_URL=https://oauth.ring.com/oauth/token \
  RING_API_BASE=https://api.amazonvision.com \
  AWS_ACCESS_KEY_ID=xxx \
  AWS_SECRET_ACCESS_KEY=xxx \
  AWS_REGION=us-east-1 \
  S3_BUCKET_NAME=your-bucket \
  FIREBASE_PROJECT_ID=xxx \
  FIREBASE_CLIENT_EMAIL=xxx \
  FIREBASE_PRIVATE_KEY="xxx"

# 6. Deploy
flyctl deploy

# 7. Run DB schema
flyctl ssh console -C "psql \$DATABASE_URL -f /app/src/db/schema.sql"
```

## After Deploy

```bash
# Check health
curl https://ring-ai-motion-notifier.fly.dev/health

# Link Ring account (opens browser for OAuth)
curl https://ring-ai-motion-notifier.fly.dev/oauth/link \
  -H "x-admin-key: your_admin_secret"

# Sync devices
curl https://ring-ai-motion-notifier.fly.dev/devices \
  -H "x-admin-key: your_admin_secret"
```

Register these URLs in the **Ring Developer Portal**:
- **Webhook URL:** `https://ring-ai-motion-notifier.fly.dev/webhooks/ring`
- **Token Exchange URL:** `https://ring-ai-motion-notifier.fly.dev/oauth/callback`

## Motion Event Flow

```
Camera detects motion
        ↓
Ring sends POST to /webhooks/ring  (HMAC signed)
        ↓
Backend verifies signature → saves event to DB
        ↓
Fetches MP4 clip from Ring Media API
        ↓
Uploads clip to S3
        ↓
Generates AI summary (OpenAI or fallback)
        ↓
Sends push notification with summary + clip URL
```

## Health Check

```bash
curl https://ring-ai-motion-notifier.fly.dev/health
# { "status": "ok", "uptime": 3600, "timestamp": "..." }
```

## Local Development

```bash
npm install
cp .env.example .env   # fill in your values
npm run dev

# Expose locally for webhook testing
npx ngrok http 3000
```

## Fly.io Regions
Change `primary_region` in `fly.toml` to the closest region:
- `iad` — US East (Virginia)
- `lax` — US West (Los Angeles)
- `lhr` — Europe (London)
- `nrt` — Asia Pacific (Tokyo)
- `syd` — Australia (Sydney)
