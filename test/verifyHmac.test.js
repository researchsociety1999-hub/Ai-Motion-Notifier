const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const verifyHmac = require('../src/middleware/verifyHmac');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('verifyHmac', () => {
  it('accepts a valid signature over rawBody', () => {
    process.env.RING_HMAC_KEY = 'test-secret';
    const raw = Buffer.from(JSON.stringify({ type: 'motion_detected', timestamp: new Date().toISOString() }));
    const hex = crypto.createHmac('sha256', 'test-secret').update(raw).digest('hex');

    const req = {
      headers: { 'x-signature': `sha256=${hex}` },
      rawBody: raw,
      body: JSON.parse(raw.toString('utf8')),
    };
    const res = mockRes();
    let nextCalled = false;
    verifyHmac(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it('rejects when rawBody is missing', () => {
    process.env.RING_HMAC_KEY = 'test-secret';
    const req = { headers: { 'x-signature': 'sha256=abc' }, body: {} };
    const res = mockRes();
    let nextCalled = false;
    verifyHmac(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it('rejects invalid signature without throwing on length mismatch', () => {
    process.env.RING_HMAC_KEY = 'test-secret';
    const raw = Buffer.from('{"a":1}');
    const req = {
      headers: { 'x-signature': 'sha256=deadbeef' },
      rawBody: raw,
      body: { a: 1 },
    };
    const res = mockRes();
    verifyHmac(req, res, () => {});
    assert.equal(res.statusCode, 401);
  });
});
