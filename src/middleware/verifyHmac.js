const crypto = require('crypto');

/**
 * Middleware: verify Ring HMAC-SHA256 webhook signature
 * Ring sends the signature as: x-signature: sha256=<hex_digest>
 */
function verifyHmac(req, res, next) {
  const signature = req.headers['x-signature'];

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  if (!process.env.RING_HMAC_KEY) {
    console.error('[verifyHmac] RING_HMAC_KEY environment variable is not configured');
    return res.status(500).json({ error: 'Server authentication configuration error' });
  }

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expectedHex = crypto
    .createHmac('sha256', process.env.RING_HMAC_KEY)
    .update(rawBody)
    .digest('hex');

  const expectedSignature = `sha256=${expectedHex}`;

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    console.warn('[verifyHmac] HMAC signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

module.exports = verifyHmac;
