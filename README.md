# Ring AI Motion Notifier

A Node.js/Express backend that listens for Ring camera motion events via webhooks, fetches the recorded video clip, and sends push notifications.

## Features
- OAuth 2.0 Ring account linking
- HMAC-verified webhook ingestion
- Automatic video clip download from Ring Media API
- Push notifications via Firebase Cloud Messaging (FCM)
- Token refresh background job
- AI-ready: easy to plug in OpenAI/Rekognition for clip analysis

## Stack
- Node.js + Express
- PostgreSQL (via `pg`)
- Firebase Admin SDK (push notifications)
- AWS S3 (clip storage)
- `node-cron` (token refresh scheduler)

## Project Structure
```
ring-ai-motion-notifier/
├── src/
│   ├── server.js          # Express app entry point
│   ├── routes/
│   │   ├── oauth.js       # Ring OAuth token exchange + account linking
│   │   ├── webhook.js     # Webhook receiver + HMAC verification
│   │   └── devices.js     # Device sync and listing
│   ├── services/
│   │   ├── ringApi.js     # Ring API calls (devices, clips, tokens)
│   │   ├── storage.js     # S3 clip upload
│   │   ├── notify.js      # FCM push notification sender
│   │   └── tokenManager.js# Token refresh background job
│   ├── db/
│   │   ├── index.js       # pg pool setup
│   │   └── schema.sql     # DB schema
│   └── middleware/
│       └── verifyHmac.js  # HMAC-SHA256 signature check
├── .env.example
├── package.json
└── README.md
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
# Fill in all values in .env
```

### 3. Set up the database
```bash
psql -U youruser -d yourdb -f src/db/schema.sql
```

### 4. Run the server
```bash
npm run dev
```

### 5. Expose your local server (for development)
```bash
npx ngrok http 3000
# Copy the HTTPS URL and register it in the Ring Developer Portal as your Webhook URL
```

## Ring Developer Portal Setup
1. Register at https://developer.amazon.com/ring/console/apps
2. Create a new app and save your `Client ID`, `Client Secret`, and `HMAC Signing Key`
3. Set your endpoint URLs:
   - **Token Exchange URL:** `https://yourapp.com/oauth/token`
   - **Webhook URL:** `https://yourapp.com/webhooks/ring`
   - **Account Link URL:** `https://yourapp.com/ring/link`

## Environment Variables
See `.env.example` for all required variables.
