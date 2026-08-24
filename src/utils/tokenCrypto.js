const crypto = require('crypto');

/**
 * AES-256-GCM helpers for encrypting Ring tokens at rest.
 * Requires TOKEN_ENCRYPTION_KEY = 32-byte key as 64-char hex (or any string hashed to 32 bytes).
 *
 * Format: base64(iv[12] || authTag[16] || ciphertext)
 */

function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  }
  // Accept 64-char hex or arbitrary secret (SHA-256 → 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function encryptToken(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptToken(ciphertext) {
  if (ciphertext == null || ciphertext === '') return ciphertext;
  const key = getKey();
  const buf = Buffer.from(String(ciphertext), 'base64');
  if (buf.length < 12 + 16 + 1) {
    throw new Error('Invalid encrypted token payload');
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = { encryptToken, decryptToken };
