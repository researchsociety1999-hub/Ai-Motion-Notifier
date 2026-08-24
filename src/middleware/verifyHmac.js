const crypto = require('crypto');

/**
 * Middleware: verify Ring HMAC-SHA256 webhook signature over the *raw* body.
 * Ring sends: x-signature: sha256=<hex_digest>
 *
 * Requires express.json({ verify }) in server.js to set req.rawBody (Buffer).
 * Also rejects events whose body timestamp is outside an acceptable skew window
 * (replay mitigation) when a timestamp field is present.
 */
const MAX_SKEW_MS = 5 * 60 * 1000; // 5 minutes

function verifyHmac(req, res, next) {
  const signature = req.headers['x-signature'];

  if (!signature || typeof signature !== 'string') {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  const rawBody = req.rawBody;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    console.warn('HMAC verification failed: rawBody missing (express.json verify not configured)');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const hmacKey = process.env.RING_HMAC_KEY;
  if (!hmacKey) {
    console.error('RING_HMAC_KEY is not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const expectedHex = crypto
    .createHmac('sha256', hmacKey)
    .update(rawBody)
    .digest('hex');

  const expectedHeader = `sha256=${expectedHex}`;

  // Timing-safe compare: require equal byte length first (timingSafeEqual throws otherwise)
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedHeader, 'utf8');

  if (sigBuf.length !== expBuf.length) {
    console.warn('HMAC verification failed: length mismatch');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.warn('HMAC verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Replay window: if body has a timestamp, reject outside skew
  const ts = req.body?.timestamp;
  if (ts != null) {
    const eventMs = new Date(ts).getTime();
    if (Number.isNaN(eventMs) || Math.abs(Date.now() - eventMs) > MAX_SKEW_MS) {
      console.warn('Webhook timestamp outside acceptable skew window');
      return res.status(401).json({ error: 'Event timestamp out of range' });
    }
  }

  next();
}

module.exports = verifyHmac;
