import { useEffect, useRef, useState } from 'react';
import { checkUsername } from '../lib/authApi';

// mirrors backend/src/utils/validators.js — the server is still the real check
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,18})[a-z0-9]$/;
export const USERNAME_RULES = '3–20 characters: letters, numbers, dots or underscores, starting and ending with a letter or number';

export const normalizeUsername = v => String(v || '').trim().replace(/^@/, '').toLowerCase();
export const isValidUsername = v => USERNAME_RE.test(v) && !v.includes('..');

/* Live availability check while typing: format first (instant, local),
   then the server once typing pauses — or right away via check().
   status: 'empty' | 'invalid' | 'waiting' (paused before the lookup) |
           'checking' (lookup in flight) | 'available' | 'taken' | 'error' */
export function useUsernameCheck(raw) {
  const username = normalizeUsername(raw);
  const [state, setState] = useState({ for: '', status: 'empty' });
  // bumped by check() to re-run the lookup — to skip the typing pause, or retry after a failed check
  const [attempt, setAttempt] = useState(0);
  const skipWait = useRef(false);

  useEffect(() => {
    if (!username || !isValidUsername(username)) return undefined;
    let cancelled = false;
    const wait = skipWait.current ? 0 : 600;
    skipWait.current = false;
    setState({ for: username, status: 'waiting' });
    const t = setTimeout(async () => {
      setState({ for: username, status: 'checking' });
      try {
        const res = await checkUsername(username);
        if (!cancelled) setState({ for: username, status: res.available ? 'available' : 'taken' });
      } catch {
        if (!cancelled) setState({ for: username, status: 'error' });
      }
    }, wait);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, attempt]);

  const check = () => {
    skipWait.current = true;
    setAttempt(a => a + 1);
  };

  let status;
  if (!username) status = 'empty';
  else if (!isValidUsername(username)) status = 'invalid';
  else status = state.for === username ? state.status : 'waiting';

  const error = status === 'invalid' ? USERNAME_RULES : status === 'taken' ? `@${username} is already taken — try another` : status === 'error' ? "Couldn't check right now — tap Retry" : '';
  const hint = status === 'available' ? `@${username} is available` : '';
  return { username, status, ok: status === 'available', error, hint, check };
}
