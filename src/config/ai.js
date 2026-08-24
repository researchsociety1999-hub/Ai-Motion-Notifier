// Centralized AI configuration for OpenRouter tiered processing

module.exports = {
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  
  // Model Tiers (comma-separated or single model string)
  tier1Models: (process.env.AI_MODEL_TIER_1 || 'google/gemini-2.0-flash-exp:free,meta-llama/llama-3.2-11b-vision-instruct:free,qwen/qwen-2.5-vl-72b-instruct:free').split(',').map(m => m.trim()),
  tier2Models: (process.env.AI_MODEL_TIER_2 || 'google/gemini-2.0-flash-001,openai/gpt-4o-mini').split(',').map(m => m.trim()),
  tier3Models: (process.env.AI_MODEL_TIER_3 || 'openai/gpt-4o').split(',').map(m => m.trim()),

  // Escalation & Confidence Thresholds
  confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.6'),
  escalateOnThreatLevels: ['high', 'medium'],

  // Pre-filter / Debounce Window (seconds)
  debounceSeconds: parseInt(process.env.MOTION_DEBOUNCE_SECONDS || '30', 10),

  // Free Tier Proactive Rate Limit Caps (buffers under OpenRouter hard caps)
  freeRateLimits: {
    maxPerMinute: parseInt(process.env.OPENROUTER_FREE_MAX_PER_MINUTE || '18', 10), // cap is 20/min
    maxPerDay: parseInt(process.env.OPENROUTER_FREE_MAX_PER_DAY || '45', 10),       // cap is 50/day
  },
};
