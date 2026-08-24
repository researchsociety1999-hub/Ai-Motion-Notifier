const axios = require('axios');

const BASE = process.env.RING_API_BASE;
/** Max clip size accepted into memory (20 MB) */
const MAX_CLIP_BYTES = 20 * 1024 * 1024;

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
      maxContentLength: MAX_CLIP_BYTES,
      maxBodyLength: MAX_CLIP_BYTES,
    }
  );

  const buf = Buffer.from(res.data);
  if (buf.length > MAX_CLIP_BYTES) {
    throw new Error(`Clip exceeds max size (${buf.length} > ${MAX_CLIP_BYTES})`);
  }
  return buf;
}

/**
 * Fetch a snapshot image for a device
 */
async function fetchSnapshot(deviceId, accessToken) {
  const res = await axios.get(`${BASE}/v1/devices/${deviceId}/snapshot`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'arraybuffer',
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 5 * 1024 * 1024,
  });
  return Buffer.from(res.data);
}

module.exports = { getDevices, fetchClip, fetchSnapshot };
