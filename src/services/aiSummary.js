const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Generate an AI text summary of a motion event using OpenAI
 * Falls back gracefully if OPENAI_API_KEY is not set
 *
 * @param {object} opts
 * @param {string} opts.subType   - Ring classification: human, animal, vehicle, unknown
 * @param {string} opts.deviceName - Friendly camera name
 * @param {string} opts.timestamp  - ISO timestamp of the event
 * @param {string} [opts.clipUrl]  - S3 URL of the clip (included in context)
 * @returns {string} Human-readable event summary
 */
async function generateEventSummary({ subType, deviceName, timestamp, clipUrl }) {
  if (!process.env.OPENAI_API_KEY) {
    // Graceful fallback — no AI key configured
    return buildFallbackSummary({ subType, deviceName, timestamp });
  }

  const time = new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const prompt = [
    `You are a home security assistant. Summarize the following Ring camera motion event in one short, clear sentence suitable for a push notification.`,
    `Camera: ${deviceName}`,
    `Time: ${time}`,
    `Detected: ${subType || 'motion'}`,
    clipUrl ? `Clip available: yes` : '',
    `Write only the summary sentence, no preamble.`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.4,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      }
    );

    return res.data.choices?.[0]?.message?.content?.trim() ||
      buildFallbackSummary({ subType, deviceName, timestamp });
  } catch (err) {
    console.warn('OpenAI summary failed, using fallback:', err.message);
    return buildFallbackSummary({ subType, deviceName, timestamp });
  }
}

function buildFallbackSummary({ subType, deviceName, timestamp }) {
  const time = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const who = subType === 'human' ? 'A person'
    : subType === 'animal' ? 'An animal'
    : subType === 'vehicle' ? 'A vehicle'
    : 'Motion';
  return `${who} was detected by ${deviceName} at ${time}.`;
}

module.exports = { generateEventSummary };
