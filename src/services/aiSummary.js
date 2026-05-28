const axios = require('axios');

/**
 * Generate an AI text summary of a motion event using OpenAI
 * Now accepts optional vision classification result for richer summaries
 * Falls back gracefully if OPENAI_API_KEY is not set
 *
 * @param {object} opts
 * @param {string} opts.subType          - Ring classification: human, animal, vehicle, unknown
 * @param {string} opts.deviceName       - Friendly camera name
 * @param {string} opts.timestamp        - ISO timestamp of the event
 * @param {string} [opts.clipUrl]        - S3 URL of the clip
 * @param {object} [opts.visionResult]   - Result from aiVision.classifyMotionFrame
 * @returns {string} Human-readable event summary
 */
async function generateEventSummary({ subType, deviceName, timestamp, clipUrl, visionResult }) {
  if (!process.env.OPENAI_API_KEY) {
    return buildFallbackSummary({ subType, deviceName, timestamp, visionResult });
  }

  const time = new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Use vision description if available and confident
  const detectionContext = visionResult && visionResult.confidence >= 0.5
    ? `Vision AI detected: ${visionResult.classification} (${Math.round(visionResult.confidence * 100)}% confidence) — "${visionResult.description}"`
    : `Ring detected: ${subType || 'motion'}`;

  const prompt = [
    `You are a home security assistant. Summarize the following Ring camera motion event in one short, clear sentence suitable for a push notification.`,
    `Camera: ${deviceName}`,
    `Time: ${time}`,
    detectionContext,
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
      buildFallbackSummary({ subType, deviceName, timestamp, visionResult });
  } catch (err) {
    console.warn('OpenAI summary failed, using fallback:', err.message);
    return buildFallbackSummary({ subType, deviceName, timestamp, visionResult });
  }
}

function buildFallbackSummary({ subType, deviceName, timestamp, visionResult }) {
  const time = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Prefer vision result if available and confident
  const type = (visionResult && visionResult.confidence >= 0.5)
    ? visionResult.classification
    : subType;

  const who = type === 'person' || type === 'human' ? 'A person'
    : type === 'animal' ? 'An animal'
    : type === 'vehicle' ? 'A vehicle'
    : type === 'package' ? 'A package'
    : 'Motion';

  return `${who} was detected by ${deviceName} at ${time}.`;
}

module.exports = { generateEventSummary };
