-- Ring AI Motion Notifier — Database Schema

-- Linked Ring accounts and their OAuth tokens
CREATE TABLE IF NOT EXISTS ring_accounts (
  id            SERIAL PRIMARY KEY,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Ring devices synced from the API
CREATE TABLE IF NOT EXISTS devices (
  id           SERIAL PRIMARY KEY,
  device_id    TEXT UNIQUE NOT NULL,
  name         TEXT,
  type         TEXT,
  capabilities JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Motion events received from Ring webhooks
CREATE TABLE IF NOT EXISTS motion_events (
  id              SERIAL PRIMARY KEY,
  device_id       TEXT NOT NULL,
  event_type      TEXT NOT NULL,         -- e.g. motion_detected
  sub_type        TEXT,                  -- e.g. human, animal, vehicle
  event_timestamp TIMESTAMPTZ NOT NULL,
  clip_url        TEXT,                  -- S3 URL of the downloaded clip
  notified        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motion_events_device ON motion_events(device_id);
CREATE INDEX IF NOT EXISTS idx_motion_events_timestamp ON motion_events(event_timestamp);
