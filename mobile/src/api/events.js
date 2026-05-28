import { API_URL, ADMIN_SECRET } from '../config';

const headers = {
  'Content-Type': 'application/json',
  'x-admin-secret': ADMIN_SECRET,
};

/**
 * Fetch motion events from the backend
 */
export async function fetchEvents({ limit = 20, offset = 0, classification } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (classification) params.append('classification', classification);
  const res = await fetch(`${API_URL}/events?${params}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  return res.json();
}

/**
 * Fetch a single event by ID
 */
export async function fetchEvent(id) {
  const res = await fetch(`${API_URL}/events/${id}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch event: ${res.status}`);
  return res.json();
}

/**
 * Fetch all registered devices
 */
export async function fetchDevices() {
  const res = await fetch(`${API_URL}/devices`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch devices: ${res.status}`);
  return res.json();
}
