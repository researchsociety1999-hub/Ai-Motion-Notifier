require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const webhookRoutes = require('./routes/webhook');
const deviceRoutes = require('./routes/devices');
const eventRoutes = require('./routes/events');
const requireSecret = require('./middleware/requireSecret');
const { generalLimiter, oauthLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Serve admin dashboard (public folder)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Security headers — allow dashboard styling/scripts
app.use(helmet({ contentSecurityPolicy: false }));
app.set('trust proxy', 1);

// JSON body parser with 10MB limit for base64 frames and rawBody capture for HMAC verification
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

app.use(generalLimiter);

// Webhook routes (HMAC verified)
app.use('/webhooks', webhookRoutes);

// Protected API routes
app.use('/devices', requireSecret, deviceRoutes);
app.use('/events',  requireSecret, eventRoutes);

// Note: /oauth routes are deprecated in favor of the local Raspberry Pi bridge.
// const oauthRoutes = require('./routes/oauth');
// app.use('/oauth', oauthLimiter, requireSecret, oauthRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use(errorHandler);

module.exports = app;
