const axios = require('axios');

const BASE = process.env.RING_API_BASE;

/**
 * Fetch list of Ring devices for the authenticated account
 */
async function getDevices(accessToken) {
  const res = await axios.get(`${BASE}/v1/devices`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data.devices || [];
}

/**
 * Download MP4 video clip for a motion event
 * @param {string} deviceId - Ring device ID
 * @param {string} timestamp - ISO timestamp from the webhook event
 * @param {string} accessToken - Valid Ring Bearer token
 * @returns {Buffer} MP4 clip binary data
 */
async function fetchClip(deviceId, timestamp, accessToken) {
  const res = await axios.post(
    `${BASE}/v1/devices/${deviceId}/media/video/download`,
    { timestamp },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
    }
  );
  return Buffer.from(res.data);
}

/**
 * Fetch a snapshot image for a device
 */
async function fetchSnapshot(deviceId, accessToken) {
  const res = await axios.get(
    `${BASE}/v1/devices/${deviceId}/snapshot`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
    }
  );
  return Buffer.from(res.data);
}

module.exports = { getDevices, fetchClip, fetchSnapshot };
