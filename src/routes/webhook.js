const express = require('express');
const router = express.Router();
const verifyHmac = require('../middleware/verifyHmac');
const db = require('../db');
const { fetchClip } = require('../services/ringApi');
const { uploadToS3 } = require('../services/storage');
const { sendPushNotification } = require('../services/notify');
const { getValidAccessToken } = require('../services/tokenManager');
const { generateEventSummary } = require('../services/aiSummary');

/**
 * POST /webhooks/ring
 * Receives Ring event notifications (motion, doorbell press, etc.)
 */
router.post('/ring', verifyHmac, async (req, res) => {
  // Always respond 200 immediately — Ring requires response within 5 seconds
  res.status(200).send('OK');

  const event = req.body;
  console.log(`[Webhook] Event received: type=${event.type} device=${event.deviceId}`);

  if (event.type !== 'motion_detected') return;

  const { deviceId, timestamp, subType } = event;

  try {
    // 1. Look up device name from DB
    const deviceResult = await db.query(
      'SELECT name FROM devices WHERE device_id = $1',
      [deviceId]
    );
    const deviceName = deviceResult.rows[0]?.name || deviceId;

    // 2. Save event to DB
    const insertResult = await db.query(
      `INSERT INTO motion_events (device_id, event_type, sub_type, event_timestamp)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [deviceId, event.type, subType || 'unknown', new Date(timestamp)]
    );
    const eventId = insertResult.rows[0].id;

    // 3. Get valid access token
    const accessToken = await getValidAccessToken();

    // 4. Fetch the video clip from Ring
    const clipBuffer = await fetchClip(deviceId, timestamp, accessToken);

    // 5. Upload clip to S3
    const clipKey = `clips/${deviceId}/${timestamp}.mp4`;
    const clipUrl = await uploadToS3(clipBuffer, clipKey);

    // 6. Generate AI summary
    const summary = await generateEventSummary({
      subType,
      deviceName,
      timestamp,
      clipUrl,
    });

    // 7. Update DB with clip URL and AI summary
    await db.query(
      `UPDATE motion_events
       SET clip_url = $1, ai_summary = $2, notified = TRUE
       WHERE id = $3`,
      [clipUrl, summary, eventId]
    );

    // 8. Send push notification with AI summary
    await sendPushNotification({
      title: '🚨 Motion Detected',
      body: summary,
      clipUrl,
    });

    console.log(`[Webhook] ✅ Event ${eventId} processed. Clip: ${clipUrl}`);
  } catch (err) {
    console.error('[Webhook] ❌ Error processing motion event:', err.message);
  }
});

module.exports = router;
