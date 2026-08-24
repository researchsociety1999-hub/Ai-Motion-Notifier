const axios = require('axios');

/**
 * AI Vision Classification Service
 * Analyzes a Ring camera snapshot/frame using OpenAI GPT-4o Vision.
 * Expects an image URL or base64 image — not a video URL.
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

  // Guard: refuse obvious video URLs (vision models expect images)
  if (imageUrl && /\.mp4(\?|$)/i.test(imageUrl)) {
    console.warn('[aiVision] Refusing video URL as vision input');
    return buildFallbackClassification();
  }

  const imageContent = imageUrl
    ? { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
    : {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' },
      };

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
            content: [{ type: 'text', text: prompt }, imageContent],
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
