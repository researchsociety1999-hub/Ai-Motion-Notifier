const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');
const { encryptToken } = require('../services/crypto');

/**
 * GET /oauth/link
 * Redirect user to Ring OAuth authorization page
 */
router.get('/link', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.RING_CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${req.protocol}://${req.get('host')}/oauth/callback`,
    scope: 'client',
  });
  res.redirect(`https://oauth.ring.com/oauth/authorize?${params}`);
});

/**
 * GET /oauth/callback
 * Ring redirects here after user approves; exchange auth code for tokens
 */
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing auth code' });

  try {
    const response = await axios.post(
      process.env.RING_OAUTH_URL || 'https://oauth.ring.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.RING_CLIENT_ID,
        client_secret: process.env.RING_CLIENT_SECRET,
        redirect_uri: `${req.protocol}://${req.get('host')}/oauth/callback`,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    const encryptedAccess = encryptToken(access_token);
    const encryptedRefresh = encryptToken(refresh_token);

    // Save tokens to DB (upsert singleton row)
    await db.query(
      `INSERT INTO ring_accounts (access_token, refresh_token, expires_at, singleton)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (singleton) DO UPDATE
       SET access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           expires_at = EXCLUDED.expires_at,
           updated_at = NOW()`,
      [encryptedAccess, encryptedRefresh, expiresAt]
    );

    res.json({ message: 'Ring account linked successfully!' });
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

module.exports = router;
