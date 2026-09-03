import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadSession, saveSession, clearSession, clearPendingRegistration } from '../lib/authStorage';

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

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (session) {
        setUser(session.user);
        setToken(session.token);
      }
      await clearPendingRegistration();
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (token && user) saveSession({ token, user });
    else clearSession();
  }, [token, user, ready]);

  const signIn = (nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, ready, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
