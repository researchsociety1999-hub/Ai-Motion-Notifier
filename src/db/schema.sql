-- Ring AI Motion Notifier — Database Schema

-- Linked Ring accounts and their OAuth tokens (tokens stored encrypted at rest)
-- Single-row-per-install model: account_slot UNIQUE enforces one primary account row.
CREATE TABLE IF NOT EXISTS ring_accounts (
  id              SERIAL PRIMARY KEY,
  account_slot    INTEGER NOT NULL DEFAULT 1,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ring_accounts_single_slot UNIQUE (account_slot)
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
  id                    SERIAL PRIMARY KEY,
  device_id             TEXT NOT NULL,
  event_type            TEXT NOT NULL,
  sub_type              TEXT,
  event_timestamp       TIMESTAMPTZ NOT NULL,
  clip_url              TEXT,
  ai_summary            TEXT,
  -- Phase 1: AI Vision Classification fields
  ai_classification     TEXT,
  ai_confidence         NUMERIC(4,3),
  ai_description        TEXT,
  ai_threat_level       TEXT DEFAULT 'none',
  ai_source             TEXT DEFAULT 'fallback',
  notification_priority TEXT DEFAULT 'medium',
  notified              BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  -- Idempotency: one row per device + event time
  CONSTRAINT motion_events_device_ts_unique UNIQUE (device_id, event_timestamp)
);

-- Migrations for existing deployments (safe to re-run):
-- ALTER TABLE ring_accounts ADD COLUMN IF NOT EXISTS account_slot INTEGER NOT NULL DEFAULT 1;
-- CREATE UNIQUE INDEX IF NOT EXISTS ring_accounts_single_slot ON ring_accounts (account_slot);
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS ai_classification     TEXT;
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS ai_confidence         NUMERIC(4,3);
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS ai_description        TEXT;
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS ai_threat_level       TEXT DEFAULT 'none';
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS ai_source             TEXT DEFAULT 'fallback';
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS notification_priority TEXT DEFAULT 'medium';
-- CREATE UNIQUE INDEX IF NOT EXISTS motion_events_device_ts_unique ON motion_events (device_id, event_timestamp);

CREATE INDEX IF NOT EXISTS idx_motion_events_device         ON motion_events(device_id);
CREATE INDEX IF NOT EXISTS idx_motion_events_timestamp      ON motion_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_motion_events_classification ON motion_events(ai_classification);
CREATE INDEX IF NOT EXISTS idx_motion_events_priority       ON motion_events(notification_priority);
