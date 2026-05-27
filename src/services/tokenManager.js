const axios = require('axios');
const cron = require('node-cron');
const db = require('../db');

/**
 * Get a valid access token, refreshing it if it expires within 10 minutes
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
    return refreshToken(account);
  }

  return account.access_token;
}

/**
 * Refresh an expired or near-expiring Ring access token
 */
async function refreshToken(account) {
  const res = await axios.post(
    process.env.RING_OAUTH_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
      client_id: process.env.RING_CLIENT_ID,
      client_secret: process.env.RING_CLIENT_SECRET,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, refresh_token, expires_in } = res.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  await db.query(
    `UPDATE ring_accounts
     SET access_token = $1, refresh_token = $2, expires_at = $3
     WHERE id = $4`,
    [access_token, refresh_token, expiresAt, account.id]
  );

  console.log('✅ Ring access token refreshed');
  return access_token;
}

/**
 * Background job: refresh all tokens every 24 hours
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
