# Ring AI Notifier — Mobile App

React Native + Expo mobile app for the Ring AI Motion Notifier backend.
Receives real-time push notifications and shows motion event history with AI classification.

---

## Screens

- **Events** — live feed of motion events with AI classification badges and confidence bars
- **Event Detail** — full event info, AI description, clip viewer, priority level
- **Settings** — backend URL config, connection health check, priority guide

---

## Quick Start

### Step 1 — Install dependencies
```bash
cd mobile
npm install
```

### Step 2 — Set environment variables
```bash
cp .env.example .env
```
Edit `.env`:
```
EXPO_PUBLIC_API_URL=https://ring-ai-motion-notifier.fly.dev
EXPO_PUBLIC_ADMIN_SECRET=your_admin_secret_key
```

### Step 3 — Preview UI instantly (no build needed)
```bash
npx expo start
```
Scan the QR code with **Expo Go** on your phone (App Store / Play Store).

> ⚠️ Expo Go does NOT support @react-native-firebase.
> For real push notifications you need an EAS build (Step 4).

### Step 4 — Build with EAS for real push notifications
```bash
npm install -g eas-cli
eas login
eas build --platform android   # or ios
```
Install the `.apk` / `.ipa` from the EAS dashboard on your device.

---

## Firebase Setup (Required for Push Notifications)

### 1. Create / open your Firebase project
- Go to [console.firebase.google.com](https://console.firebase.google.com)
- Use the same project as your backend

### 2. Add your app in Firebase Console
- **Android** → Add Android app → package: `com.ringainotifier.app`
  → Download `google-services.json` → place in `mobile/`
- **iOS** → Add iOS app → bundle ID: `com.ringainotifier.app`
  → Download `GoogleService-Info.plist` → place in `mobile/`

> ⚠️ Both files are gitignored — never commit them.

---

## Folder Structure

```
mobile/
├── App.js                        # Root — navigation + notification hook
├── app.json                      # Expo config
├── package.json
├── .env.example                  # Copy to .env
├── google-services.json          # ← YOU add (gitignored)
├── GoogleService-Info.plist      # ← YOU add (gitignored)
└── src/
    ├── config.js                 # API URL, display config
    ├── api/events.js             # Fetches from backend /events + /devices
    ├── hooks/useNotifications.js # Firebase FCM + topic subscription
    └── screens/
        ├── EventsScreen.js       # Motion events feed
        ├── EventDetailScreen.js  # Single event + clip viewer
        └── SettingsScreen.js     # Backend URL + health check
```

---

## Notification Priority

| Classification | Time | Priority | Phone behaviour |
|---|---|---|---|
| Person | Night (10pm–6am) | 🔴 High | Loud alert, time-sensitive |
| Person | Day | 🟠 Medium | Standard push |
| Vehicle | Any | 🟠 Medium | Standard push |
| Package | Any | 🔵 Low | Quiet, no sound |
| Animal | Any | ⚫ Silent | No notification |
| Confidence < 40% | Any | ⚫ Silent | No notification |
