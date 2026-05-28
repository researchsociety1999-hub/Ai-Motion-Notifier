const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * AI Vision Classification Service
 * Analyzes a Ring camera snapshot/frame using OpenAI GPT-4o Vision
 * Returns structured classification: type, confidence, description
 *
 * @param {object} opts
 * @param {string} [opts.imageUrl]    - Public URL of a snapshot/frame (preferred)
 * @param {string} [opts.imageBase64] - Base64-encoded image as fallback
 * @param {string} opts.deviceName    - Camera name for context
 * @param {string} opts.timestamp     - ISO timestamp
 * @returns {VisionResult}
 */
async function classifyMotionFrame({ imageUrl, imageBase64, deviceName, timestamp }) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[aiVision] No OPENAI_API_KEY — using fallback classification');
    return buildFallbackClassification();
  }

  if (!imageUrl && !imageBase64) {
    console.warn('[aiVision] No image provided — using fallback classification');
    return buildFallbackClassification();
  }

  const imageContent = imageUrl
    ? { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
    : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' } };

  const prompt = [
    'You are a home security AI. Analyze this camera snapshot and classify what triggered the motion.',
    `Camera: ${deviceName}`,
    `Time: ${new Date(timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
    '',
    'Respond ONLY with a JSON object in this exact format (no markdown, no explanation):',
    '{',
    '  "classification": "person" | "vehicle" | "animal" | "package" | "unknown",',
    '  "confidence": 0.0-1.0,',
    '  "description": "one short sentence describing what you see",',
    '  "threat_level": "high" | "medium" | "low" | "none"',
    '}',
  ].join('\n');

  try {
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              imageContent,
            ],
          },
        ],
        max_tokens: 150,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      }
    );

    const raw = res.data.choices?.[0]?.message?.content?.trim();
    if (!raw) return buildFallbackClassification();

    // Strip any accidental markdown code fences
    const cleaned = raw.replace(/```json?\n?|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      classification: parsed.classification || 'unknown',
      confidence: parseFloat(parsed.confidence) || 0,
      description: parsed.description || '',
      threat_level: parsed.threat_level || 'none',
      source: 'gpt-4o-vision',
    };
  } catch (err) {
    console.warn('[aiVision] Vision classification failed:', err.message);
    return buildFallbackClassification();
  }
}

/**
 * Map a Ring sub_type string to our classification schema
 * Used when no image is available but Ring provides its own detection
 */
function mapRingSubType(subType) {
  const map = {
    human: 'person',
    animal: 'animal',
    vehicle: 'vehicle',
    loitering: 'person',
    package_delivery: 'package',
  };
  return map[subType] || 'unknown';
}

function buildFallbackClassification(subType) {
  return {
    classification: subType ? mapRingSubType(subType) : 'unknown',
    confidence: 0,
    description: '',
    threat_level: 'none',
    source: 'fallback',
  };
}

module.exports = { classifyMotionFrame, mapRingSubType, buildFallbackClassification };
