// Vercel Cron Job — called every 24 hours via vercel.json crons config
// Replaces the node-cron job that cannot run in serverless environments
const { getValidAccessToken } = require('../../src/services/tokenManager');

module.exports = async (req, res) => {
  // Protect against unauthorized calls
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await getValidAccessToken();
    console.log('✅ Cron: Token refresh completed');
    res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('❌ Cron: Token refresh failed:', err.message);
    res.status(500).json({ error: err.message });
  }
};
