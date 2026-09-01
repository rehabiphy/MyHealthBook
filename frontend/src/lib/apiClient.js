import { API_BASE_URL } from './apiConfig';

/* Generic fetch wrapper shared by every API module (authApi.js today,
   any future one tomorrow) — JSON in/out, optional Bearer token,
   throws a plain Error with the backend's own message on failure so
   callers can just `catch (err) { setError(err.message) }`. */
export async function apiRequest(path, { method = 'POST', body, token } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Something went wrong. Please try again.');
  }
  return json;
}
