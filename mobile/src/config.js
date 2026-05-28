// Central config — reads from .env (EXPO_PUBLIC_ prefix exposes to client)
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ring-ai-motion-notifier.fly.dev';
export const ADMIN_SECRET = process.env.EXPO_PUBLIC_ADMIN_SECRET || '';

// Notification topic — must match backend notify.js
export const FCM_TOPIC = 'ring-motion-alerts';

// Classification display config
export const CLASSIFICATION_CONFIG = {
  person:  { emoji: '🧍', color: '#ef4444', label: 'Person' },
  vehicle: { emoji: '🚗', color: '#f97316', label: 'Vehicle' },
  animal:  { emoji: '🐾', color: '#84cc16', label: 'Animal' },
  package: { emoji: '📦', color: '#3b82f6', label: 'Package' },
  unknown: { emoji: '❓', color: '#6b7280', label: 'Unknown' },
};

// Priority display config
export const PRIORITY_CONFIG = {
  high:   { color: '#ef4444', label: 'High' },
  medium: { color: '#f97316', label: 'Medium' },
  low:    { color: '#3b82f6', label: 'Low' },
  silent: { color: '#6b7280', label: 'Silent' },
};
