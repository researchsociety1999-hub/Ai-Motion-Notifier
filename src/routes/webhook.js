const express = require('express');
const router = express.Router();
const verifyHmac = require('../middleware/verifyHmac');
const db = require('../db');
const { fetchClip, fetchSnapshot } = require('../services/ringApi');
const { uploadToSupabaseStorage } = require('../services/storage');
const { sendPushNotification } = require('../services/notify');
const { getValidAccessToken } = require('../services/tokenManager');
const { generateEventSummary } = require('../services/aiSummary');
const { classifyMotionFrame } = require('../services/aiVision');

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
  const eventTs = new Date(timestamp);

  try {
    // 1. Look up device name from DB
    const deviceResult = await db.query(
      'SELECT name FROM devices WHERE device_id = $1',
      [deviceId]
    );
    const deviceName = deviceResult.rows[0]?.name || deviceId;

    // 2. Idempotent insert — skip downstream if this event already exists
    const insertResult = await db.query(
      `INSERT INTO motion_events (device_id, event_type, sub_type, event_timestamp)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (device_id, event_timestamp) DO NOTHING
       RETURNING id`,
      [deviceId, event.type, subType || 'unknown', eventTs]
    );

    if (!insertResult.rows.length) {
      console.log(`[Webhook] Duplicate event skipped: device=${deviceId} ts=${timestamp}`);
      return;
    }
    const eventId = insertResult.rows[0].id;

    // 3. Get valid access token
    const accessToken = await getValidAccessToken();

    // 4. Fetch the video clip from Ring (size-capped inside fetchClip)
    const clipBuffer = await fetchClip(deviceId, timestamp, accessToken);

    // 5. Upload clip to Supabase Storage
    const clipKey = `clips/${deviceId}/${timestamp}.mp4`;
    const clipUrl = await uploadToSupabaseStorage(clipBuffer, clipKey);

    // 6. Vision input: prefer snapshot image; never pass MP4 URL as image
    let visionImageUrl = event.snapshot_url || null;
    let visionBase64 = null;

    if (!visionImageUrl) {
      try {
        const snapBuf = await fetchSnapshot(deviceId, accessToken);
        visionBase64 = snapBuf.toString('base64');
      } catch (snapErr) {
        console.warn('[Webhook] Snapshot fetch failed; skipping vision classification:', snapErr.message);
      }
    }

    let visionResult;
    if (visionImageUrl || visionBase64) {
      visionResult = await classifyMotionFrame({
        imageUrl: visionImageUrl || undefined,
        imageBase64: visionBase64 || undefined,
        deviceName,
        timestamp,
      });
    } else {
      visionResult = {
        classification: 'unknown',
        confidence: 0,
        description: '',
        threat_level: 'none',
        source: 'skipped-no-image',
      };
      console.warn('[Webhook] No snapshot available; vision classification skipped');
    }

    console.log(
      `[Webhook] Vision: ${visionResult.classification} (${Math.round((visionResult.confidence || 0) * 100)}%) — ${visionResult.description}`
    );

    // 7. Generate AI summary
    const summary = await generateEventSummary({
      subType,
      deviceName,
      timestamp,
      clipUrl,
      visionResult,
    });

    // 8. Update DB
    await db.query(
      `UPDATE motion_events
       SET clip_url              = $1,
           ai_summary            = $2,
           ai_classification     = $3,
           ai_confidence         = $4,
           ai_description        = $5,
           ai_threat_level       = $6,
           ai_source             = $7,
           notification_priority = $8,
           notified              = TRUE
       WHERE id = $9`,
      [
        clipUrl,
        summary,
        visionResult.classification,
        visionResult.confidence,
        visionResult.description,
        visionResult.threat_level,
        visionResult.source,
        visionResult.classification === 'animal'
          ? 'silent'
          : visionResult.confidence < 0.4
            ? 'silent'
            : visionResult.classification === 'person' && new Date(timestamp).getHours() >= 22
              ? 'high'
              : visionResult.classification === 'person' && new Date(timestamp).getHours() < 6
                ? 'high'
                : visionResult.classification === 'package'
                  ? 'low'
                  : 'medium',
        eventId,
      ]
    );

    // 9. Push notification
    await sendPushNotification({
      title: '🚨 Motion Detected',
      body: summary,
      clipUrl,
      classification: visionResult.classification,
      confidence: visionResult.confidence,
      timestamp,
      deviceName,
    });

    console.log(
      `[Webhook] Event ${eventId} processed — ${visionResult.classification}. Clip: ${clipUrl}`
    );
  } catch (err) {
    console.error('[Webhook] Error processing motion event:', err.message);
  }
});

module.exports = router;
