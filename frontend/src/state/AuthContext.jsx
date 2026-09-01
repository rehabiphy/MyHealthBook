import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadSession, saveSession, clearSession, loadPendingRegistration } from '../lib/authStorage';

const AuthContext = createContext(null);

/* Modeled on DataContext: a mount-effect loads persisted state then
   flips `ready`, a persist-effect (gated on `ready`) saves on every
   change. `pendingRegistration` is read once at boot only — it drives
   which screen AuthStack opens on (Register, pre-filled, instead of
   Login) if the app was killed mid-signup; the live "is this email
   verified yet" polling/deep-link state is screen-scoped in
   RegisterScreen itself, not owned here. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [pendingRegistration, setPendingRegistration] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (session) {
        setUser(session.user);
        setToken(session.token);
      }
      setPendingRegistration(await loadPendingRegistration());
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

  return (
    <AuthContext.Provider value={{ user, token, ready, pendingRegistration, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
