import { API_BASE_URL } from './apiConfig';

/* Generic fetch wrapper shared by every API module (authApi.js today,
   any future one tomorrow) — JSON in/out, optional Bearer token,
   throws a plain Error with the backend's own message on failure so
   callers can just `catch (err) { setError(err.message) }`.

   `token` is normally the session token string. It can also be
   `{ token, familyOwner }` — the same call then acts on the record of a
   family member who shared it (the backend checks the share on every
   request). That lets DataContext reuse every API module unchanged for
   a family member's data just by passing a different `token`. */
export async function apiRequest(path, { method = 'POST', body, token } = {}) {
  const { token: bearer, familyOwner } = token && typeof token === 'object' ? token : { token };
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(familyOwner ? { 'X-Family-Owner': familyOwner } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const err = new Error(json?.message || 'Something went wrong. Please try again.');
    if (json) Object.assign(err, json);
    throw err;
  }
  return json;
}
