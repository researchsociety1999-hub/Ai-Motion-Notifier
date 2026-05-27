require('dotenv').config();
const express = require('express');
const oauthRoutes = require('./routes/oauth');
const webhookRoutes = require('./routes/webhook');
const deviceRoutes = require('./routes/devices');
const { startTokenRefreshJob } = require('./services/tokenManager');

const app = express();
app.use(express.json());

// Routes
app.use('/oauth', oauthRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/devices', deviceRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Start token refresh scheduler (runs every 24 hours)
startTokenRefreshJob();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ring AI Notifier running on port ${PORT}`);
});

module.exports = app;
