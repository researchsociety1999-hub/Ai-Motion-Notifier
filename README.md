# Ring AI Motion Notifier

A production-ready Node.js/Express backend that listens for Ring camera motion events via webhooks, downloads the video clip, generates an AI summary, and sends a push notification — all automatically.

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
- ✅ Railway one-click deploy config

## Stack
- **Runtime:** Node.js 18+
- **Framework:** Express
- **Database:** PostgreSQL (via `pg`)
- **Storage:** AWS S3
- **Push notifications:** Firebase Admin SDK (FCM)
- **AI summaries:** OpenAI GPT-4o-mini (optional)
- **Scheduler:** node-cron
- **Security:** Helmet, express-rate-limit, HMAC verification

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
├── railway.json                # Railway deploy config
├── Procfile                    # Heroku/Render deploy
├── .env.example
├── package.json
└── README.md
```

## Setup

### 1. Clone and install
```bash
git clone https://github.com/researchsociety1999-hub/ring-ai-motion-notifier
cd ring-ai-motion-notifier
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
# Fill in all values — see .env.example for details
```

Generate a secure admin key:
```bash
openssl rand -hex 32
```

### 3. Set up the database
```bash
psql -U youruser -d yourdb -f src/db/schema.sql
```

### 4. Run locally
```bash
npm run dev
```

### 5. Expose to the internet (local dev only)
```bash
npx ngrok http 3000
# Copy the HTTPS URL → paste as Webhook URL in Ring Developer Portal
```

## Deploy to Railway (Recommended)

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Select `ring-ai-motion-notifier`
3. Add a **PostgreSQL** plugin (auto-injects `DATABASE_URL`)
4. Go to **Variables** → add all values from `.env.example`
5. Railway builds and deploys → you get a stable HTTPS URL
6. Register your URL in the Ring Developer Portal:
   - **Webhook URL:** `https://your-app.up.railway.app/webhooks/ring`
   - **Token Exchange URL:** `https://your-app.up.railway.app/oauth/callback`

## Calling Protected Routes

Admin routes require the `x-admin-key` header:

```bash
# Link Ring account
curl https://your-app.up.railway.app/oauth/link \
  -H "x-admin-key: your_admin_secret"

# Sync devices
curl https://your-app.up.railway.app/devices \
  -H "x-admin-key: your_admin_secret"
```

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
curl https://your-app.up.railway.app/health
# { "status": "ok", "uptime": 3600, "timestamp": "..." }
```
