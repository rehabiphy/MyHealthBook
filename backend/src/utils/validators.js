const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

export function isNonEmptyString(value, { max = 200 } = {}) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

export function isValidPhone(value) {
  return typeof value === 'string' && value.trim().length >= 10;
}

export function isValidPassword(value) {
  return typeof value === 'string' && value.length >= 6 && value.length <= 128;
}

export function isValidNumber(value, { min, max } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

export function isOneOf(value, allowed) {
  return allowed.includes(value);
}

export function isValidStringArray(value, { allowed, min = 0 } = {}) {
  if (!Array.isArray(value) || value.length < min) return false;
  if (allowed) return value.every(v => allowed.includes(v));
  return value.every(v => typeof v === 'string');
}

export function isValidDayKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
