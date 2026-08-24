const express = require('express');
const router = express.Router();
const verifyHmac = require('../middleware/verifyHmac');
const db = require('../db');
const { fetchClip, fetchSnapshot } = require('../services/ringApi');
const { uploadToStorage } = require('../services/storage');
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
  console.log('[Webhook] Ring event received:', JSON.stringify(event, null, 2));

  // Only process motion events
  if (event.type !== 'motion_detected') return;

  const { deviceId, timestamp, subType } = event;

  try {
    // 1. Save event to DB with idempotency guard
    const insertResult = await db.query(
      `INSERT INTO motion_events (device_id, event_type, sub_type, event_timestamp)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (device_id, event_timestamp) DO NOTHING
       RETURNING id`,
      [deviceId, event.type, subType || 'unknown', new Date(timestamp)]
    );

    if (!insertResult.rows.length) {
      console.log(`[Webhook] Duplicate event ignored for device ${deviceId} at ${timestamp}`);
      return;
    }

    const eventId = insertResult.rows[0].id;

    // 2. Get a valid access token
    const accessToken = await getValidAccessToken();

    // 3. Resolve device friendly name
    const devResult = await db.query(
      'SELECT name FROM devices WHERE device_id = $1 LIMIT 1',
      [deviceId]
    );
    const deviceName = devResult.rows[0]?.name || deviceId;

    // 4. Fetch the video clip from Ring
    const clipBuffer = await fetchClip(deviceId, timestamp, accessToken);

    // 5. Upload clip to Supabase Storage
    const clipKey = `clips/${deviceId}/${timestamp}.mp4`;
    const clipUrl = await uploadToStorage(clipBuffer, clipKey);

    // 6. Resolve snapshot / frame for AI vision
    let visionResult;
    if (event.snapshot_url) {
      visionResult = await classifyMotionFrame({
        imageUrl: event.snapshot_url,
        deviceName,
        timestamp,
      });
    } else {
      try {
        const snapshotBuffer = await fetchSnapshot(deviceId, accessToken);
        if (snapshotBuffer && snapshotBuffer.length > 0) {
          visionResult = await classifyMotionFrame({
            imageBase64: snapshotBuffer.toString('base64'),
            deviceName,
            timestamp,
          });
        }
      } catch (snapErr) {
        console.warn('[Webhook] Snapshot fetch not available:', snapErr.message);
      }

      if (!visionResult) {
        console.log('[Webhook] No image snapshot available — marking ai_source as skipped_no_image');
        visionResult = {
          classification: subType ? (subType === 'human' ? 'person' : subType) : 'unknown',
          confidence: 0,
          description: `Motion detected (${subType || 'motion'})`,
          threat_level: 'none',
          source: 'skipped_no_image',
        };
      }
    }

    console.log(`[Webhook] Vision: ${visionResult.classification} (${Math.round((visionResult.confidence || 0) * 100)}%) [source: ${visionResult.source}]`);

    // 7. Generate AI summary using vision result for context
    const summary = await generateEventSummary({
      subType,
      deviceName,
      timestamp,
      clipUrl,
      visionResult,
    });

    // 8. Update DB with clip URL, AI summary, and vision classification
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
        visionResult.classification === 'animal' ? 'silent'
          : visionResult.confidence < 0.4 && visionResult.source === 'gpt-4o-vision' ? 'silent'
          : (visionResult.classification === 'person' && (new Date(timestamp).getHours() >= 22 || new Date(timestamp).getHours() < 6)) ? 'high'
          : visionResult.classification === 'package' ? 'low'
          : 'medium',
        eventId,
      ]
    );

    // 9. Send smart push notification
    await sendPushNotification({
      title: '🚨 Motion Detected',
      body: summary,
      clipUrl,
      classification: visionResult.classification,
      confidence: visionResult.confidence,
      timestamp,
      deviceName,
    });

    console.log(`[Webhook] ✅ Event ${eventId} processed. Priority stored. Clip: ${clipUrl}`);
  } catch (err) {
    console.error('[Webhook] ❌ Error processing motion event:', err.message);
  }
});

module.exports = router;
