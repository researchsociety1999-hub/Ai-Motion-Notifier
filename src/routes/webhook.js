const express = require('express');
const router = express.Router();
const verifyHmac = require('../middleware/verifyHmac');
const verifyLocalMotionHmac = require('../middleware/verifyLocalMotionHmac');
const { processMotionEvent } = require('../services/eventPipeline');

/**
 * POST /webhooks/local-motion
 * Receives motion events and frames dispatched by local Raspberry Pi bridge
 */
router.post('/local-motion', verifyLocalMotionHmac, async (req, res) => {
  res.status(200).send('OK');

  const { deviceId, timestamp, subType, imageBase64, imageUrl } = req.body;
  if (!deviceId || !timestamp) {
    console.warn('[Webhook-Local] Missing required deviceId or timestamp');
    return;
  }

  console.log(`[Webhook-Local] Motion event received from Pi bridge for ${deviceId} at ${timestamp}`);

  try {
    const imageBuffer = imageBase64 ? Buffer.from(imageBase64, 'base64') : null;
    await processMotionEvent({
      deviceId,
      timestamp,
      subType: subType || 'motion',
      imageBuffer,
      imageUrl,
    });
  } catch (err) {
    console.error('[Webhook-Local] Error executing event pipeline:', err.message);
  }
});

/**
 * POST /webhooks/ring (Legacy / Cloud-Partner route)
 */
router.post('/ring', verifyHmac, async (req, res) => {
  res.status(200).send('OK');

  const event = req.body;
  if (event.type !== 'motion_detected') return;

  const { deviceId, timestamp, subType, snapshot_url } = event;

  try {
    await processMotionEvent({
      deviceId,
      timestamp,
      subType: subType || 'unknown',
      imageUrl: snapshot_url,
    });
  } catch (err) {
    console.error('[Webhook-Ring] Error executing event pipeline:', err.message);
  }
});

module.exports = router;
