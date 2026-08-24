const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not configured');
  }
  const keyBuffer = Buffer.from(keyHex, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 characters)');
  }
  return keyBuffer;
}

function encryptToken(plainText) {
  if (!plainText) return plainText;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptToken(cipherText) {
  if (!cipherText) return cipherText;
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    return cipherText;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[crypto] Failed to decrypt token:', err.message);
    throw err;
  }
}

module.exports = { encryptToken, decryptToken };
