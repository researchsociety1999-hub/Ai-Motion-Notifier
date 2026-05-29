# Ring AI Motion Notifier — Setup Guide

Complete step-by-step setup for **Supabase + Vercel + Firebase**.

---

## Stack Overview

| Component | Purpose |
|---|---|
| **Supabase** | PostgreSQL database + video clip storage |
| **Vercel** | Hosts the Express API (serverless) |
| **Firebase FCM** | Sends push notifications to mobile app |
| **Ring API** | Detects motion, provides video clips |
| **OpenAI GPT-4o** | Classifies what triggered the motion |

---

## Step 1 — Firebase (Push Notifications)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Create Project** → name it `ring-motion-notifier`
3. Go to ⚙️ **Project Settings** → **Service Accounts** tab
4. Click **Generate New Private Key** → download JSON
5. From the JSON, copy:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep `\n` newlines)

---

## Step 2 — Supabase (Database + Storage)

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name: `ring-motion-notifier`, set a strong password
3. Wait 2–3 minutes for initialization

### Get API keys
- Go to **Settings** → **API**
- Copy `Project URL` → `SUPABASE_URL`
- Copy `anon public` key → `SUPABASE_KEY`
- Copy `service_role` key → `SUPABASE_SERVICE_KEY`

### Create the database tables
- Go to **SQL Editor** → paste contents of `src/db/schema.sql` → Run

### Create the storage bucket
- Go to **Storage** → **Create Bucket**
- Name: `ring-clips`
- Set to **Private**

---

## Step 3 — Ring Developer Credentials

1. Go to [developer.ring.com](https://developer.ring.com)
2. Create an application
3. Copy `Client ID` → `RING_CLIENT_ID`
4. Copy `Client Secret` → `RING_CLIENT_SECRET`
5. Register your webhook URL: `https://your-app.vercel.app/webhooks/ring`
6. Copy the HMAC signing key → `RING_HMAC_KEY`

---

## Step 4 — Deploy to Vercel

### Option A — Via Vercel Dashboard (easiest)
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your `ring-ai-motion-notifier` repo
4. Add all environment variables from `.env.example`
5. Click **Deploy**

### Option B — Via CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Set environment variables on Vercel
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_KEY
vercel env add SUPABASE_SERVICE_KEY
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY
vercel env add RING_CLIENT_ID
vercel env add RING_CLIENT_SECRET
vercel env add RING_HMAC_KEY
vercel env add OPENAI_API_KEY
vercel env add ADMIN_SECRET_KEY
```

---

## Step 5 — Test Locally

```bash
cp .env.example .env
# Fill in all values in .env
npm install
npm start
```

Check health endpoint:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{ "status": "ok", "uptime": 1.2, "timestamp": "2026-05-29T..." }
```

---

## Environment Variables Summary

| Variable | Required | Where to get it |
|---|---|---|
| `ADMIN_SECRET_KEY` | ✅ | `openssl rand -hex 32` |
| `RING_CLIENT_ID` | ✅ | Ring Developer Portal |
| `RING_CLIENT_SECRET` | ✅ | Ring Developer Portal |
| `RING_HMAC_KEY` | ✅ | Ring webhook registration |
| `SUPABASE_URL` | ✅ | Supabase Settings → API |
| `SUPABASE_KEY` | ✅ | Supabase Settings → API |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase Settings → API |
| `FIREBASE_PROJECT_ID` | ✅ | Firebase service account JSON |
| `FIREBASE_CLIENT_EMAIL` | ✅ | Firebase service account JSON |
| `FIREBASE_PRIVATE_KEY` | ✅ | Firebase service account JSON |
| `OPENAI_API_KEY` | Optional | platform.openai.com |
