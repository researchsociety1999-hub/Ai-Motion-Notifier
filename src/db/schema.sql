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
  id                    SERIAL PRIMARY KEY,
  device_id             TEXT NOT NULL,
  event_type            TEXT NOT NULL,
  sub_type              TEXT,
  event_timestamp       TIMESTAMPTZ NOT NULL,
  clip_url              TEXT,
  ai_summary            TEXT,
  -- Phase 1: AI Vision Classification fields
  ai_classification     TEXT,                  -- person | vehicle | animal | package | unknown
  ai_confidence         NUMERIC(4,3),          -- 0.000 - 1.000
  ai_description        TEXT,                  -- raw vision description sentence
  ai_threat_level       TEXT DEFAULT 'none',   -- high | medium | low | none
  ai_source             TEXT DEFAULT 'fallback', -- gpt-4o-vision | fallback
  notification_priority TEXT DEFAULT 'medium', -- high | medium | low | silent
  notified              BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add AI vision columns to existing deployments
-- Run this if you already have a motion_events table without these columns:
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS ai_classification     TEXT;
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS ai_confidence         NUMERIC(4,3);
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS ai_description        TEXT;
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS ai_threat_level       TEXT DEFAULT 'none';
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS ai_source             TEXT DEFAULT 'fallback';
-- ALTER TABLE motion_events ADD COLUMN IF NOT EXISTS notification_priority TEXT DEFAULT 'medium';

CREATE INDEX IF NOT EXISTS idx_motion_events_device         ON motion_events(device_id);
CREATE INDEX IF NOT EXISTS idx_motion_events_timestamp      ON motion_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_motion_events_classification ON motion_events(ai_classification);
CREATE INDEX IF NOT EXISTS idx_motion_events_priority       ON motion_events(notification_priority);
