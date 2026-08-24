const axios = require('axios');
const cron = require('node-cron');
const db = require('../db');
const { encryptToken, decryptToken } = require('./crypto');

let refreshPromise = null;

/**
 * Get a valid access token, refreshing it if it expires within 10 minutes.
 * Uses single-flight locking to prevent concurrent token refresh race conditions.
 */
async function getValidAccessToken() {
  const result = await db.query(
    `SELECT id, access_token, refresh_token, expires_at
     FROM ring_accounts
     ORDER BY id DESC LIMIT 1`
  );

  if (!result.rows.length) throw new Error('No Ring account linked');

  const account = result.rows[0];
  const expiresAt = new Date(account.expires_at);
  const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);

  // If token expires within 10 minutes, refresh it
  if (expiresAt <= tenMinutesFromNow) {
    if (!refreshPromise) {
      refreshPromise = refreshToken(account).finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  return decryptToken(account.access_token);
}

/**
 * Refresh an expired or near-expiring Ring access token
 */
async function refreshToken(account) {
  const plainRefreshToken = decryptToken(account.refresh_token);

  const res = await axios.post(
    process.env.RING_OAUTH_URL || 'https://oauth.ring.com/oauth/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: plainRefreshToken,
      client_id: process.env.RING_CLIENT_ID,
      client_secret: process.env.RING_CLIENT_SECRET,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, refresh_token, expires_in } = res.data;
  const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

  const encryptedAccess = encryptToken(access_token);
  const encryptedRefresh = encryptToken(refresh_token);

  await db.query(
    `UPDATE ring_accounts
     SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
     WHERE id = $4`,
    [encryptedAccess, encryptedRefresh, expiresAt, account.id]
  );

  console.log('✅ Ring access token refreshed and encrypted in database');
  return access_token;
}

/**
 * Background job: refresh all tokens every 24 hours (for non-serverless dev runtimes)
 */
function startTokenRefreshJob() {
  cron.schedule('0 */24 * * *', async () => {
    console.log('Running token refresh job...');
    try {
      await getValidAccessToken();
    } catch (err) {
      console.error('Token refresh job failed:', err.message);
    }
  });
  console.log('Token refresh job scheduled (every 24h)');
}

module.exports = { getValidAccessToken, startTokenRefreshJob };
