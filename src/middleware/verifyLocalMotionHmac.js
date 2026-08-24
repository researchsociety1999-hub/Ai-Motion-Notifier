const crypto = require('crypto');

/**
 * Middleware: verify Raspberry Pi Bridge HMAC-SHA256 signature
 * Header: x-signature: sha256=<hex_digest>
 */
function verifyLocalMotionHmac(req, res, next) {
  const signature = req.headers['x-signature'];

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  const secret = process.env.PI_BRIDGE_SECRET;
  if (!secret) {
    console.error('[verifyLocalMotionHmac] PI_BRIDGE_SECRET environment variable is not configured');
    return res.status(500).json({ error: 'Bridge authentication configuration error' });
  }

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expectedSignature = `sha256=${expectedHex}`;

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    console.warn('[verifyLocalMotionHmac] HMAC signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

module.exports = verifyLocalMotionHmac;
