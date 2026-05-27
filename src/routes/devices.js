const express = require('express');
const router = express.Router();
const { getDevices } = require('../services/ringApi');
const { getValidAccessToken } = require('../services/tokenManager');
const db = require('../db');

/**
 * GET /devices
 * Fetch and sync Ring devices for the linked account
 */
router.get('/', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken();
    const devices = await getDevices(accessToken);

    // Sync devices to DB
    for (const device of devices) {
      await db.query(
        `INSERT INTO devices (device_id, name, type, capabilities)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (device_id) DO UPDATE
         SET name = $2, type = $3, capabilities = $4`,
        [device.id, device.name, device.type, JSON.stringify(device.capabilities)]
      );
    }

    res.json({ devices });
  } catch (err) {
    console.error('Error fetching devices:', err.message);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

module.exports = router;
