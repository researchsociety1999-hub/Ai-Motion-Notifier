const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { encryptToken, decryptToken } = require('../src/utils/tokenCrypto');

describe('tokenCrypto', () => {
  it('round-trips a token', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
    const plain = 'ring-access-token-value';
    const enc = encryptToken(plain);
    assert.notEqual(enc, plain);
    assert.equal(decryptToken(enc), plain);
  });
});
