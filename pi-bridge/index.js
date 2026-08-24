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

if (!PI_BRIDGE_SECRET) {
  console.error('[Pi-Bridge] FATAL: PI_BRIDGE_SECRET environment variable is required');
  process.exit(1);
}

console.log(`[Pi-Bridge] Connecting to MQTT broker at ${MQTT_BROKER}...`);
const client = mqtt.connect(MQTT_BROKER, {
  reconnectPeriod: 5000,
  connectTimeout: 30000,
});

client.on('connect', () => {
  console.log('[Pi-Bridge] Connected to MQTT broker');
  // Subscribe to all Ring camera motion state topics
  // Topic pattern from ring-mqtt: ring/<location_id>/camera/<device_id>/motion/state
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

  // Extract deviceId from topic: ring/<location_id>/camera/<device_id>/motion/state
  const parts = topic.split('/');
  const deviceId = parts[3] || 'ring_camera';
  const timestamp = new Date().toISOString();

  console.log(`[Pi-Bridge] 🚨 Motion detected on camera: ${deviceId}`);

  try {
    const imageBase64 = await captureFrame(deviceId);
    await sendLocalMotionEvent({
      deviceId,
      timestamp,
      subType: 'motion',
      imageBase64,
    });
  } catch (err) {
    console.error(`[Pi-Bridge] Failed to process motion event for ${deviceId}:`, err.message);
  }
});

/**
 * Capture frame from go2rtc HTTP snapshot API or fallback to ffmpeg RTSP stream
 */
async function captureFrame(deviceId) {
  // Option 1: Fast HTTP snapshot from go2rtc
  try {
    const res = await axios.get(`${GO2RTC_SNAPSHOT_BASE}${deviceId}_live`, {
      responseType: 'arraybuffer',
      timeout: 8000,
    });
    if (res.data && res.data.length > 0) {
      console.log(`[Pi-Bridge] Captured frame via go2rtc HTTP (${res.data.length} bytes)`);
      return Buffer.from(res.data).toString('base64');
    }
  } catch (httpErr) {
    console.warn(`[Pi-Bridge] go2rtc HTTP snapshot failed (${httpErr.message}), falling back to ffmpeg RTSP...`);
  }

  // Option 2: Fallback to FFmpeg RTSP extraction
  return new Promise((resolve, reject) => {
    const tempFile = path.join('/tmp', `snap_${deviceId}_${Date.now()}.jpg`);
    const rtspUrl = `${RTSP_BASE}${deviceId}_live`;
    const cmd = `ffmpeg -y -rtsp_transport tcp -i "${rtspUrl}" -frames:v 1 -q:v 2 "${tempFile}"`;

    exec(cmd, { timeout: 12000 }, (error) => {
      if (error) {
        return reject(new Error(`FFmpeg capture error: ${error.message}`));
      }
      try {
        const data = fs.readFileSync(tempFile);
        fs.unlinkSync(tempFile);
        console.log(`[Pi-Bridge] Captured frame via FFmpeg (${data.length} bytes)`);
        resolve(data.toString('base64'));
      } catch (readErr) {
        reject(readErr);
      }
    });
  });
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
