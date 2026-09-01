import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { verifyEmail, checkVerificationStatus } from '../lib/authApi';

const VERIFY_LINK_RE = /^myhealthbook:\/\/verify\?(.+)$/i;

function parseVerifyLink(url) {
  const match = VERIFY_LINK_RE.exec(url || '');
  if (!match) return null;
  const params = new URLSearchParams(match[1]);
  const email = decodeURIComponent(params.get('email') || '');
  const token = params.get('token');
  if (!email || !token) return null;
  return { email, token };
}

/* Dual-mode resolution, matching the reference: an instant deep-link
   callback if the app is still alive when the verify link is tapped,
   plus a 3s poll as a fallback for when the OS reclaimed the process
   in between. Whichever resolves first wins — onVerified is only ever
   meant to be called once, calling it twice is harmless (RegisterScreen
   just sets the same state again). */
export function useDeepLinkVerification({ email, active, onVerified }) {
  // Keep the latest callback in a ref rather than the effect's own
  // dependency array — RegisterScreen passes an inline arrow function,
  // and depending on it directly would tear down/restart the listener
  // and reset the 3s poll timer on every re-render.
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  useEffect(() => {
    if (!active || !email) return undefined;

    let cancelled = false;
    const targetEmail = email.toLowerCase();

    const tryUrl = async url => {
      const parsed = parseVerifyLink(url);
      if (!parsed || parsed.email.toLowerCase() !== targetEmail) return;
      try {
        const res = await verifyEmail({ email, token: parsed.token });
        if (!cancelled && res.verified) onVerifiedRef.current();
      } catch {
        // stale/expired link — the poll below still catches a real verification
      }
    };

    Linking.getInitialURL().then(tryUrl);
    const sub = Linking.addEventListener('url', ({ url }) => tryUrl(url));

    const pollId = setInterval(async () => {
      try {
        const res = await checkVerificationStatus({ email });
        if (!cancelled && res.verified) onVerifiedRef.current();
      } catch {
        // network hiccup — next tick retries
      }
    }, 3000);

    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(pollId);
    };
  }, [active, email]);
}
