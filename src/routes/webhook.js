const express = require('express');
const router = express.Router();
const verifyHmac = require('../middleware/verifyHmac');
const db = require('../db');
const { fetchClip } = require('../services/ringApi');
const { uploadToS3 } = require('../services/storage');
const { sendPushNotification } = require('../services/notify');
const { getValidAccessToken } = require('../services/tokenManager');

/**
 * POST /webhooks/ring
 * Receives Ring event notifications (motion, doorbell press, etc.)
 */
router.post('/ring', verifyHmac, async (req, res) => {
  // Always respond 200 immediately — Ring requires response within 5 seconds
  res.status(200).send('OK');

  const event = req.body;
  console.log('Ring event received:', JSON.stringify(event, null, 2));

  // Only process motion events
  if (event.type !== 'motion_detected') return;

  const { deviceId, timestamp, subType } = event;

  try {
    // 1. Save event to DB
    await db.query(
      `INSERT INTO motion_events (device_id, event_type, sub_type, event_timestamp)
       VALUES ($1, $2, $3, $4)`,
      [deviceId, event.type, subType || 'unknown', new Date(timestamp)]
    );

    // 2. Get a valid access token
    const accessToken = await getValidAccessToken();

    // 3. Fetch the video clip from Ring
    const clipBuffer = await fetchClip(deviceId, timestamp, accessToken);

    // 4. Upload clip to S3
    const clipKey = `clips/${deviceId}/${timestamp}.mp4`;
    const clipUrl = await uploadToS3(clipBuffer, clipKey);

    // 5. Update DB with clip URL
    await db.query(
      `UPDATE motion_events SET clip_url = $1
       WHERE device_id = $2 AND event_timestamp = $3`,
      [clipUrl, deviceId, new Date(timestamp)]
    );

    // 6. Send push notification
    await sendPushNotification({
      title: '🚨 Motion Detected',
      body: `Camera ${deviceId} detected ${subType || 'motion'}. Tap to view clip.`,
      clipUrl,
    });

    console.log(`✅ Motion event processed. Clip: ${clipUrl}`);
  } catch (err) {
    console.error('Error processing motion event:', err.message);
  }
});

module.exports = router;
