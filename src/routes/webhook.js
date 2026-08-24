const express = require('express');
const router = express.Router();
const verifyHmac = require('../middleware/verifyHmac');
const db = require('../db');
const { fetchClip, fetchSnapshot } = require('../services/ringApi');
const { uploadToStorage } = require('../services/storage');
const { sendPushNotification } = require('../services/notify');
const { getValidAccessToken } = require('../services/tokenManager');
const { analyzeMotion } = require('../services/aiMotionAnalysis');
const aiConfig = require('../config/ai');

/**
 * POST /webhooks/ring
 * Receives Ring event notifications (motion, doorbell press, etc.)
 */
router.post('/ring', verifyHmac, async (req, res) => {
  // Respond 200 immediately to meet Ring's 5s SLA
  res.status(200).send('OK');

  const event = req.body;
  console.log('[Webhook] Ring event received:', JSON.stringify(event, null, 2));

  if (event.type !== 'motion_detected') return;

  const { deviceId, timestamp, subType } = event;

  try {
    // 1. Save event to DB with idempotency constraint
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

    // 2. Resolve device name
    const devResult = await db.query(
      'SELECT name FROM devices WHERE device_id = $1 LIMIT 1',
      [deviceId]
    );
    const deviceName = devResult.rows[0]?.name || deviceId;

    // 3. Pre-filter / Debounce: Check for recent activity from the same device within debounce window
    const recentEvent = await db.query(
      `SELECT ai_summary, ai_classification, ai_confidence, ai_description, ai_threat_level, notification_priority
       FROM motion_events
       WHERE device_id = $1
         AND id != $2
         AND event_timestamp >= ($3::timestamptz - INTERVAL '${aiConfig.debounceSeconds} seconds')
         AND ai_classification IS NOT NULL
       ORDER BY event_timestamp DESC
       LIMIT 1`,
      [deviceId, eventId, new Date(timestamp)]
    );

    let aiResult;
    let clipUrl = null;

    if (recentEvent.rows.length > 0) {
      const prior = recentEvent.rows[0];
      console.log(`[Webhook] Debounced: Recent motion on ${deviceId} within ${aiConfig.debounceSeconds}s — reusing prior classification`);
      aiResult = {
        classification: prior.ai_classification,
        confidence: prior.ai_confidence,
        description: prior.ai_description,
        threat_level: prior.ai_threat_level,
        summary: prior.ai_summary,
        source: 'debounced_reuse',
        tier: 'debounce',
      };
    } else {
      // 4. Token & media retrieval
      const accessToken = await getValidAccessToken();

      // Retrieve clip
      const clipBuffer = await fetchClip(deviceId, timestamp, accessToken);
      const clipKey = `clips/${deviceId}/${timestamp}.mp4`;
      clipUrl = await uploadToStorage(clipBuffer, clipKey);

      // Resolve snapshot image
      let snapshotBase64 = null;
      if (!event.snapshot_url) {
        try {
          const snapshotBuffer = await fetchSnapshot(deviceId, accessToken);
          if (snapshotBuffer && snapshotBuffer.length > 0) {
            snapshotBase64 = snapshotBuffer.toString('base64');
          }
        } catch (snapErr) {
          console.warn('[Webhook] Snapshot fetch failed:', snapErr.message);
        }
      }

      // 5. Single combined AI analysis (Vision + Summary via tiered OpenRouter)
      aiResult = await analyzeMotion({
        imageUrl: event.snapshot_url,
        imageBase64: snapshotBase64,
        subType,
        deviceName,
        timestamp,
      });
    }

    console.log(`[Webhook] AI Output: ${aiResult.classification} (${Math.round((aiResult.confidence || 0) * 100)}%) [source: ${aiResult.source}]`);

    // 6. Update database record
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
        aiResult.summary,
        aiResult.classification,
        aiResult.confidence,
        aiResult.description,
        aiResult.threat_level,
        aiResult.source,
        aiResult.classification === 'animal' ? 'silent'
          : aiResult.confidence < 0.4 && aiResult.source.startsWith('openrouter') ? 'silent'
          : (aiResult.classification === 'person' && (new Date(timestamp).getHours() >= 22 || new Date(timestamp).getHours() < 6)) ? 'high'
          : aiResult.classification === 'package' ? 'low'
          : 'medium',
        eventId,
      ]
    );

    // 7. Send smart push notification
    await sendPushNotification({
      title: '🚨 Motion Detected',
      body: aiResult.summary,
      clipUrl,
      classification: aiResult.classification,
      confidence: aiResult.confidence,
      timestamp,
      deviceName,
    });

    console.log(`[Webhook] ✅ Event ${eventId} completed. Source: ${aiResult.source}`);
  } catch (err) {
    console.error('[Webhook] ❌ Error processing motion event:', err.message);
  }
});

module.exports = router;
