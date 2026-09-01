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
