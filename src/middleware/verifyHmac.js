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

  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', process.env.RING_HMAC_KEY)
    .update(body)
    .digest('hex');

  if (`sha256=${expected}` !== signature) {
    console.warn('HMAC verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

module.exports = verifyHmac;
