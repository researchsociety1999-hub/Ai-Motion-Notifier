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

// Security headers — allow inline scripts for dashboard
app.use(helmet({ contentSecurityPolicy: false }));
app.set('trust proxy', 1);
app.use(express.json());
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

// NOTE: app.listen() is intentionally NOT called here.
// - For Vercel serverless: api/index.js exports this app directly.
// - For local dev: use src/start.js which calls app.listen().

module.exports = app;
