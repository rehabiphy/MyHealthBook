import { API_BASE_URL } from './apiConfig';

async function request(path, { method = 'POST', body, token } = {}) {
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

export const sendVerificationEmail = ({ name, email }) => request('/api/auth/send-verification', { body: { name, email } });

export const verifyEmail = ({ email, token }) => request('/api/auth/verify-email', { body: { email, token } });

export const checkVerificationStatus = ({ email }) => request('/api/auth/verification-status', { body: { email } });

export const register = ({ name, email, phone, password }) => request('/api/auth/register', { body: { name, email, phone, password } });

export const login = ({ email, password }) => request('/api/auth/login', { body: { email, password } });

export const getMe = token => request('/api/auth/me', { method: 'GET', token });
