require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const oauthRoutes = require('./routes/oauth');
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

// JSON body parser with rawBody capture for HMAC verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

app.use(generalLimiter);

// Routes
app.use('/oauth',    oauthLimiter, requireSecret, oauthRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/devices',  requireSecret, deviceRoutes);
app.use('/events',   requireSecret, eventRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use(errorHandler);

module.exports = app;
