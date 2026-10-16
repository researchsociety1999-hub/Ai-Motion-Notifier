require('dotenv').config();
const mqtt = require('mqtt');
const axios = require('axios');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const BACKEND_URL = process.env.BACKEND_WEBHOOK_URL || 'https://ai-motion-notifier.vercel.app/webhooks/local-motion';
const PI_BRIDGE_SECRET = process.env.PI_BRIDGE_SECRET;
const GO2RTC_SNAPSHOT_BASE = process.env.GO2RTC_HTTP_URL || 'http://localhost:1984/api/frame.jpeg?src=';
const RTSP_BASE = process.env.RTSP_STREAM_BASE || 'rtsp://localhost:8554/';
const CLIP_DURATION = parseInt(process.env.CLIP_DURATION_SECONDS || '10', 10);
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(__dirname, 'recordings');

if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

if (!PI_BRIDGE_SECRET) {
  console.error('[Pi-Bridge] FATAL: PI_BRIDGE_SECRET environment variable is required');
  process.exit(1);
}

console.log(`[Pi-Bridge] Connecting to MQTT broker at ${MQTT_BROKER}...`);
const client = mqtt.connect(MQTT_BROKER, {
  reconnectPeriod: 5000,
  connectTimeout: 30000,
});

let isRecording = false;

client.on('connect', () => {
  console.log('[Pi-Bridge] Connected to MQTT broker');
  // Subscribe to all Ring camera motion state topics
  // Topic pattern: ring/<location_id>/camera/<device_id>/motion/state
  client.subscribe('ring/+/camera/+/motion/state', (err) => {
    if (err) console.error('[Pi-Bridge] Subscription error:', err.message);
    else console.log('[Pi-Bridge] Subscribed to Ring motion topics');
  });
});

client.on('error', (err) => {
  console.error('[Pi-Bridge] MQTT error:', err.message);
});

client.on('message', async (topic, message) => {
  const payloadStr = message.toString().trim();
  console.log(`[Pi-Bridge] Message on ${topic}: ${payloadStr}`);

  // Only trigger on motion state ON
  if (payloadStr.toUpperCase() !== 'ON') return;

  if (isRecording) {
    console.log('[Pi-Bridge] Already recording a clip — skipping concurrent trigger');
    return;
  }

  // Extract deviceId from topic: ring/<location_id>/camera/<device_id>/motion/state
  const parts = topic.split('/');
  const deviceId = parts[3] || 'ring_camera';
  const timestamp = new Date().toISOString();

  console.log(`[Pi-Bridge] 🚨 Motion detected on camera: ${deviceId}. Recording ${CLIP_DURATION}s clip...`);

  isRecording = true;
  try {
    const { imageBase64, clipPath } = await recordClipAndExtractFrame(deviceId, CLIP_DURATION);
    if (clipPath) {
      console.log(`[Pi-Bridge] Clip saved locally: ${clipPath}`);
    }

    await sendLocalMotionEvent({
      deviceId,
      timestamp,
      subType: 'motion',
      imageBase64,
    });
  } catch (err) {
    console.error(`[Pi-Bridge] Failed to process motion event for ${deviceId}:`, err.message);
  } finally {
    isRecording = false;
  }
});

/**
 * Record a 10s MP4 video clip from RTSP and extract a JPEG frame for AI analysis
 */
async function recordClipAndExtractFrame(deviceId, durationSeconds = 10) {
  const now = Date.now();
  const clipPath = path.join(RECORDINGS_DIR, `clip_${deviceId}_${now}.mp4`);
  const snapPath = path.join(RECORDINGS_DIR, `snap_${deviceId}_${now}.jpg`);
  const rtspUrl = `${RTSP_BASE}${deviceId}_live`;

  return new Promise((resolve) => {
    // 1. Record 10s MP4 clip from the local RTSP stream
    const recordCmd = `ffmpeg -y -rtsp_transport tcp -i "${rtspUrl}" -t ${durationSeconds} -c:v copy -c:a aac "${clipPath}"`;

    exec(recordCmd, { timeout: (durationSeconds + 5) * 1000 }, (error) => {
      if (error) {
        console.warn(`[Pi-Bridge] FFmpeg RTSP recording failed (${error.message}), falling back to go2rtc HTTP snapshot...`);
        // Fallback: fetch single frame from go2rtc HTTP API so notifications aren't lost
        return fallbackHttpSnapshot(deviceId)
          .then((imageBase64) => resolve({ imageBase64, clipPath: null }))
          .catch(() => resolve({ imageBase64: null, clipPath: null }));
      }

      // 2. Extract 1 thumbnail JPEG frame from the recorded clip for AI vision
      const snapCmd = `ffmpeg -y -ss 00:00:01 -i "${clipPath}" -frames:v 1 -q:v 2 "${snapPath}"`;
      exec(snapCmd, { timeout: 6000 }, (snapErr) => {
        let imageBase64 = null;
        if (!snapErr && fs.existsSync(snapPath)) {
          try {
            imageBase64 = fs.readFileSync(snapPath).toString('base64');
          } catch (e) {
            console.warn('[Pi-Bridge] Error reading thumbnail frame:', e.message);
          }
        }
        resolve({ imageBase64, clipPath });
      });
    });
  });
}

/**
 * Fallback snapshot capture from go2rtc HTTP API
 */
async function fallbackHttpSnapshot(deviceId) {
  const res = await axios.get(`${GO2RTC_SNAPSHOT_BASE}${deviceId}_live`, {
    responseType: 'arraybuffer',
    timeout: 8000,
  });
  if (res.data && res.data.length > 0) {
    return Buffer.from(res.data).toString('base64');
  }
  return null;
}

/**
 * Send signed POST to Vercel backend with exponential backoff retry
 */
async function sendLocalMotionEvent(payload, retries = 3, delay = 2000) {
  const jsonBody = JSON.stringify(payload);
  const signature = 'sha256=' + crypto
    .createHmac('sha256', PI_BRIDGE_SECRET)
    .update(Buffer.from(jsonBody))
    .digest('hex');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(BACKEND_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-signature': signature,
        },
        timeout: 15000,
      });
      console.log(`[Pi-Bridge] ✅ Successfully posted to backend: HTTP ${res.status}`);
      return res.data;
    } catch (err) {
      console.warn(`[Pi-Bridge] POST attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
}
