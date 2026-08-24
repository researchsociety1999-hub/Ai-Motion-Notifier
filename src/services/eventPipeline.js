const db = require('../db');
const { uploadToStorage } = require('./storage');
const { sendPushNotification } = require('./notify');
const { analyzeMotion } = require('./aiMotionAnalysis');
const aiConfig = require('../config/ai');

/**
 * Common pipeline execution after signature verification
 * @param {object} opts
 * @param {string} opts.deviceId - Camera / device ID
 * @param {string} opts.timestamp - Event ISO timestamp
 * @param {string} [opts.subType] - Motion trigger subtype (e.g. human, motion)
 * @param {Buffer} [opts.imageBuffer] - Direct image JPEG buffer (from Pi bridge)
 * @param {string} [opts.imageUrl] - Direct image URL (if hosted)
 * @param {string} [opts.clipUrl] - Video clip URL (if available)
 */
async function processMotionEvent({ deviceId, timestamp, subType = 'motion', imageBuffer, imageUrl, clipUrl = null }) {
  // 1. Save event to DB with idempotency constraint
  const insertResult = await db.query(
    `INSERT INTO motion_events (device_id, event_type, sub_type, event_timestamp)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (device_id, event_timestamp) DO NOTHING
     RETURNING id`,
    [deviceId, 'motion_detected', subType, new Date(timestamp)]
  );

  if (!insertResult.rows.length) {
    console.log(`[Pipeline] Duplicate event ignored for device ${deviceId} at ${timestamp}`);
    return { status: 'duplicate_ignored' };
  }

  const eventId = insertResult.rows[0].id;

  // 2. Resolve device friendly name
  const devResult = await db.query(
    'SELECT name FROM devices WHERE device_id = $1 LIMIT 1',
    [deviceId]
  );
  const deviceName = devResult.rows[0]?.name || deviceId;

  // 3. Pre-filter / Debounce: check if same device had motion within debounce window
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
  let finalStorageUrl = clipUrl;

  // If image buffer provided (from Pi bridge), upload snapshot to Supabase Storage
  if (imageBuffer && !imageUrl) {
    try {
      const snapshotKey = `snapshots/${deviceId}/${timestamp}.jpg`;
      finalStorageUrl = await uploadToStorage(imageBuffer, snapshotKey);
    } catch (storeErr) {
      console.warn('[Pipeline] Snapshot upload to storage failed:', storeErr.message);
    }
  }

  if (recentEvent.rows.length > 0) {
    const prior = recentEvent.rows[0];
    console.log(`[Pipeline] Debounced: Recent motion on ${deviceId} within ${aiConfig.debounceSeconds}s — reusing prior classification`);
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
    // 4. Multimodal AI analysis (Vision + Summary via OpenRouter)
    aiResult = await analyzeMotion({
      imageUrl: imageUrl || finalStorageUrl,
      imageBase64: imageBuffer ? imageBuffer.toString('base64') : null,
      subType,
      deviceName,
      timestamp,
    });
  }

  console.log(`[Pipeline] AI Output: ${aiResult.classification} (${Math.round((aiResult.confidence || 0) * 100)}%) [source: ${aiResult.source}]`);

  // 5. Update database record
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
      finalStorageUrl,
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

  // 6. Send smart push notification
  await sendPushNotification({
    title: '🚨 Motion Detected',
    body: aiResult.summary,
    clipUrl: finalStorageUrl,
    classification: aiResult.classification,
    confidence: aiResult.confidence,
    timestamp,
    deviceName,
  });

  console.log(`[Pipeline] ✅ Event ${eventId} completed. Source: ${aiResult.source}`);
  return { status: 'completed', eventId, aiResult };
}

module.exports = { processMotionEvent };
