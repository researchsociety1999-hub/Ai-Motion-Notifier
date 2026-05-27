const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /events
 * Returns motion events from DB for the dashboard
 * Query params: limit (default 100), device_id, sub_type
 */
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const { device_id, sub_type } = req.query;

    let query = `SELECT * FROM motion_events`;
    const params = [];
    const conditions = [];

    if (device_id) { params.push(device_id); conditions.push(`device_id = $${params.length}`); }
    if (sub_type)  { params.push(sub_type);  conditions.push(`sub_type = $${params.length}`); }

    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY event_timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);
    res.json({ events: result.rows, total: result.rows.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
