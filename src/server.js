require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const oauthRoutes = require('./routes/oauth');
const webhookRoutes = require('./routes/webhook');
const deviceRoutes = require('./routes/devices');
const { startTokenRefreshJob } = require('./services/tokenManager');
const requireSecret = require('./middleware/requireSecret');
const { generalLimiter, oauthLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet());

// Trust proxy (required on Railway/Render/Fly for correct IP in rate limiter)
app.set('trust proxy', 1);

app.use(express.json());

// Apply general rate limit to all routes
app.use(generalLimiter);

// Routes — OAuth and devices protected by admin secret key
app.use('/oauth', oauthLimiter, requireSecret, oauthRoutes);
app.use('/webhooks', webhookRoutes); // Ring calls this — HMAC verified inside
app.use('/devices', requireSecret, deviceRoutes);

// Health check — publicly accessible (used by Railway/Render uptime checks)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start token refresh scheduler (runs every 24 hours)
startTokenRefreshJob();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Ring AI Notifier running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
