const axios = require('axios');
const aiConfig = require('../config/ai');
const aiRateLimiter = require('./aiRateLimiter');

/**
 * Unified AI Motion Analysis Service
 * Single-call vision classification + contextual push notification summary via OpenRouter
 */
async function analyzeMotion({ imageUrl, imageBase64, subType, deviceName, timestamp }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[AI] OPENROUTER_API_KEY not configured — using fallback summary and classification');
    return buildFallbackResult({ subType, deviceName, timestamp, source: 'fallback_no_key' });
  }

  if (!imageUrl && !imageBase64) {
    console.warn('[AI] No snapshot provided — using Ring subType metadata fallback');
    return buildFallbackResult({ subType, deviceName, timestamp, source: 'fallback_no_image' });
  }

  const prompt = [
    'You are a home security AI assistant. Analyze this camera snapshot and summarize what triggered the motion.',
    `Camera: ${deviceName}`,
    `Time: ${new Date(timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
    `Ring Trigger: ${subType || 'motion'}`,
    '',
    'Respond ONLY with a JSON object in this exact format (no markdown code fences, no extra text):',
    '{',
    '  "classification": "person" | "vehicle" | "animal" | "package" | "unknown",',
    '  "confidence": 0.0-1.0,',
    '  "description": "one short sentence describing visual detection",',
    '  "threat_level": "high" | "medium" | "low" | "none",',
    '  "summary": "one clear, natural sentence summarizing the event for a push alert"',
    '}',
  ].join('\n');

  const imageContent = imageUrl
    ? { type: 'image_url', image_url: { url: imageUrl } }
    : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } };

  // 1. Tier 1: Free Models (if proactive rate limiter permits)
  if (aiRateLimiter.canUseFreeTier()) {
    for (const model of aiConfig.tier1Models) {
      try {
        aiRateLimiter.recordFreeRequest();
        const result = await callOpenRouter({ model, prompt, imageContent, apiKey });
        if (result) {
          // Check if escalation to Tier 3 is needed due to ambiguity or threat
          if (shouldEscalate(result)) {
            console.log(`[AI] Tier 1 result ambiguous (confidence: ${result.confidence}, threat: ${result.threat_level}). Escalating to Tier 3...`);
            const escalated = await callTier3({ prompt, imageContent, apiKey });
            if (escalated) return escalated;
          }
          return { ...result, source: `openrouter:${model}`, tier: 'tier1_free' };
        }
      } catch (err) {
        console.warn(`[AI] Tier 1 model (${model}) failed: ${err.message}. Trying next fallback...`);
      }
    }
  } else {
    console.log('[AI] Free tier proactive rate limit reached. Proceeding directly to Tier 2 (paid)...');
  }

  // 2. Tier 2: Cheap Paid Models
  for (const model of aiConfig.tier2Models) {
    try {
      const result = await callOpenRouter({ model, prompt, imageContent, apiKey });
      if (result) {
        if (shouldEscalate(result)) {
          console.log(`[AI] Tier 2 result ambiguous (confidence: ${result.confidence}, threat: ${result.threat_level}). Escalating to Tier 3...`);
          const escalated = await callTier3({ prompt, imageContent, apiKey });
          if (escalated) return escalated;
        }
        return { ...result, source: `openrouter:${model}`, tier: 'tier2_cheap' };
      }
    } catch (err) {
      console.warn(`[AI] Tier 2 model (${model}) failed: ${err.message}. Trying next...`);
    }
  }

  // 3. Fallback to Tier 3 if earlier tiers failed completely
  const tier3Result = await callTier3({ prompt, imageContent, apiKey });
  if (tier3Result) return tier3Result;

  // Ultimate fallback if all APIs fail
  return buildFallbackResult({ subType, deviceName, timestamp, source: 'fallback_api_error' });
}

function shouldEscalate(result) {
  if (result.confidence < aiConfig.confidenceThreshold) return true;
  if (aiConfig.escalateOnThreatLevels.includes(result.threat_level)) return true;
  return false;
}

async function callTier3({ prompt, imageContent, apiKey }) {
  for (const model of aiConfig.tier3Models) {
    try {
      const result = await callOpenRouter({ model, prompt, imageContent, apiKey });
      if (result) return { ...result, source: `openrouter:${model}`, tier: 'tier3_escalated' };
    } catch (err) {
      console.warn(`[AI] Tier 3 model (${model}) failed: ${err.message}`);
    }
  }
  return null;
}

async function callOpenRouter({ model, prompt, imageContent, apiKey }) {
  const response = await axios.post(
    `${aiConfig.openRouterBaseUrl}/chat/completions`,
    {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            imageContent,
          ],
        },
      ],
      max_tokens: 250,
      temperature: 0.1,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://ai-motion-notifier.vercel.app',
        'X-Title': 'Ai-Motion-Notifier',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  const raw = response.data?.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  const cleaned = raw.replace(/```json?\n?|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    classification: parsed.classification || 'unknown',
    confidence: parseFloat(parsed.confidence) || 0,
    description: parsed.description || '',
    threat_level: parsed.threat_level || 'none',
    summary: parsed.summary || parsed.description || 'Motion detected',
  };
}

function buildFallbackResult({ subType, deviceName, timestamp, source }) {
  const time = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const classification = subType === 'human' ? 'person'
    : subType === 'animal' ? 'animal'
    : subType === 'vehicle' ? 'vehicle'
    : subType === 'package_delivery' ? 'package'
    : 'unknown';

  const who = classification === 'person' ? 'A person'
    : classification === 'animal' ? 'An animal'
    : classification === 'vehicle' ? 'A vehicle'
    : classification === 'package' ? 'A package'
    : 'Motion';

  return {
    classification,
    confidence: 0,
    description: `${subType || 'motion'} detected by Ring sensor` flow,
    threat_level: 'none',
    summary: `${who} was detected by ${deviceName} at ${time}.`,
    source: source || 'fallback',
    tier: 'fallback',
  };
}

module.exports = { analyzeMotion };
