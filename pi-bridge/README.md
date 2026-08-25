# Ring Local Motion Bridge (Docker Host / Laptop)

Containerized bridge that listens for Ring camera motion events via `ring-mqtt`, captures a live video snapshot via `go2rtc`/`ffmpeg`, and sends HMAC-signed event payloads outbound to your Vercel backend.

## Architecture

```
[ Ring Cloud (Free Live View) ]
              ▲
              │ (Outbound WebRTC/SIP)
              ▼
    [ ring-mqtt + go2rtc ] ──(MQTT: Motion ON)──► [ Mosquitto ]
              │                                         │
              │ (RTSP / Frame HTTP)                     ▼
              └───────────────────────────────► [ ring-ai-bridge ]
                                                        │
                                                        ▼ (Outbound HTTPS + HMAC)
                                          [ Vercel: /webhooks/local-motion ]
```

## Quick Start

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Generate your Ring refresh token:
   ```bash
   docker run -it --rm --entrypoint /app/ring-mqtt/node_modules/ring-client-api/ring-auth-cli.js tsightler/ring-mqtt
   ```
   Paste the token into `RINGTOKEN=` in `.env`.

3. Start the stack:
   ```bash
   docker compose up -d --build
   ```

4. View logs:
   ```bash
   docker compose logs -f
   ```
