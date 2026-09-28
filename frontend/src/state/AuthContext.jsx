import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { loadSession, saveSession, clearSession, clearPendingRegistration } from '../lib/authStorage';
import { getMe } from '../lib/authApi';
import * as fcmApi from '../lib/fcmApi';
import { requestNotificationPermission, getFcmToken, onFcmTokenRefresh } from '../lib/notifications';
import { configureSos } from '../lib/sosNative';
import { API_BASE_URL } from '../lib/apiConfig';

const AuthContext = createContext(null);

/* Modeled on DataContext: a mount-effect loads persisted state then
   flips `ready`, a persist-effect (gated on `ready`) saves on every
   change. Registration progress is intentionally NOT persisted across
   app restarts (that used to lock RegisterScreen on a stale, already-
   sent verification from a previous session, with no way to start
   over) — clearPendingRegistration() wipes any such leftover from
   before this was removed. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const fcmTokenRef = useRef(null);

  /* Registers this device's FCM token against whoever is currently
     logged in — runs for login, register, Google sign-in, AND an app
     relaunch that restores an already-persisted session, since all of
     those just result in `token` becoming truthy. Best-effort: a
     failed permission grant or registration call shouldn't block using
     the app. Also re-registers if the token rotates while logged in. */
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    (async () => {
      try {
        await requestNotificationPermission();
        const fcmToken = await getFcmToken();
        if (cancelled) return;
        fcmTokenRef.current = fcmToken;
        await fcmApi.registerFcmToken({ token: fcmToken }, token);
      } catch {
        // permission denied, no Play Services, or a network hiccup — not fatal
      }
    })();

    const unsubscribe = onFcmTokenRefresh(async nextFcmToken => {
      fcmTokenRef.current = nextFcmToken;
      try {
        await fcmApi.registerFcmToken({ token: nextFcmToken }, token);
      } catch {
        // will retry next refresh/relaunch
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [token]);

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (session) {
        setUser(session.user);
        setToken(session.token);
      }
      await clearPendingRegistration();
      setReady(true);
      /* The persisted user is a snapshot from the last login — refresh it
         so fields added since (e.g. a username set on another device)
         are current. Best-effort: offline just keeps the snapshot. */
      if (session) {
        try {
          const res = await getMe(session.token);
          setUser(res.user);
        } catch {
          // offline or token expired — the next API call surfaces that
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (token && user) saveSession({ token, user });
    else clearSession();
  }, [token, user, ready]);

  /* Fall detection and the SOS notification buttons call the API
     natively while the app is killed — they need the current session.
     Signing out clears it, which also switches fall detection off. */
  useEffect(() => {
    if (ready) configureSos(API_BASE_URL, token);
  }, [token, ready]);

  const signIn = (nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
  };

  const signOut = async () => {
    if (token && fcmTokenRef.current) {
      try {
        await fcmApi.removeFcmToken({ token: fcmTokenRef.current }, token);
      } catch {
        // best-effort — a stale token left behind just means one fewer
        // useful push target, not a broken logout
      }
    }
    setToken(null);
    setUser(null);
  };

  /* Re-fetches the user from the backend — needed after a PayU checkout
     completes, so the app picks up the new subscription/premiumExpiry
     without forcing a re-login. */
  const refreshUser = async () => {
    if (!token) return;
    const res = await getMe(token);
    setUser(res.user);
  };

  return <AuthContext.Provider value={{ user, token, ready, signIn, signOut, refreshUser, updateUser: setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
