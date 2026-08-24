const axios = require('axios');
const cron = require('node-cron');
const db = require('../db');
const { encryptToken, decryptToken } = require('../utils/tokenCrypto');

// In-process single-flight: one concurrent refresh per account id
const refreshInFlight = new Map();

/**
 * Get a valid access token, refreshing it if it expires within 10 minutes.
 * Uses SELECT ... FOR UPDATE to serialize concurrent refreshers at the DB,
 * plus an in-process mutex for same-instance races.
 */
async function getValidAccessToken() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT id, access_token, refresh_token, expires_at
       FROM ring_accounts
       WHERE account_slot = 1
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      throw new Error('No Ring account linked');
    }

    const account = result.rows[0];
    const expiresAt = new Date(account.expires_at);
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);

    if (expiresAt > tenMinutesFromNow) {
      await client.query('COMMIT');
      return decryptToken(account.access_token);
    }

    // Single-flight by account id
    if (refreshInFlight.has(account.id)) {
      await client.query('COMMIT');
      return refreshInFlight.get(account.id);
    }

    const promise = refreshTokenWithClient(client, account)
      .finally(() => refreshInFlight.delete(account.id));
    refreshInFlight.set(account.id, promise);

    const token = await promise;
    await client.query('COMMIT');
    return token;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

async function refreshTokenWithClient(client, account) {
  const plainRefresh = decryptToken(account.refresh_token);

  const res = await axios.post(
    process.env.RING_OAUTH_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: plainRefresh,
      client_id: process.env.RING_CLIENT_ID,
      client_secret: process.env.RING_CLIENT_SECRET,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, refresh_token, expires_in } = res.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  await client.query(
    `UPDATE ring_accounts
     SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
     WHERE id = $4`,
    [encryptToken(access_token), encryptToken(refresh_token), expiresAt, account.id]
  );

  console.log('Ring access token refreshed');
  return access_token;
}

/**
 * Background job: refresh all tokens every 24 hours (long-running hosts only)
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
