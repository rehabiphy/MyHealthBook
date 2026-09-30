import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import * as subscriptionApi from '../lib/subscriptionApi';

const SubscriptionContext = createContext(null);

/* Feature names — the same keys the backend's entitlement service uses
   (backend/src/utils/entitlements.js). Screens ask can(FEATURES.X),
   never "is this user on Plus". */
export const FEATURES = {
  ADVANCED_TRENDS: 'ADVANCED_TRENDS',
  ADVANCED_HEALTH_SUMMARY: 'ADVANCED_HEALTH_SUMMARY',
  ADVANCED_REPORTS: 'ADVANCED_REPORTS',
  EXTENDED_STORAGE: 'EXTENDED_STORAGE',
  ADVANCED_MEDICATIONS: 'ADVANCED_MEDICATIONS',
  UNLIMITED_INSIGHTS: 'UNLIMITED_INSIGHTS',
  FAMILY_SHARING: 'FAMILY_SHARING',
};

// what a signed-in user has until the server says otherwise — the Free plan
const FREE = { tier: 'free', source: 'free', features: [], limits: {}, subscription: { plan: 'FREE', status: 'FREE', label: 'Free', amount: 0 }, plans: [] };

/* The server is the only source of truth for what the plan unlocks:
   this just mirrors GET /api/subscription, re-fetched on sign-in, when
   the app comes back to the foreground, and after anything that
   changes the plan. Nothing here is persisted on the phone, and the
   server enforces the same answers itself — hiding a button is only
   for the user's benefit, never the protection. */
export function SubscriptionProvider({ children }) {
  const { token } = useAuth();
  const [state, setState] = useState(FREE);
  const [loaded, setLoaded] = useState(false);

  const apply = useCallback(res => {
    setState({ tier: res.tier, source: res.source, features: res.features || [], limits: res.limits || {}, subscription: res.subscription, plans: res.plans || [] });
    setLoaded(true);
    return res;
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return null;
    try {
      return apply(await subscriptionApi.getSubscription(token));
    } catch {
      return null; // offline — keep what we last knew
    }
  }, [token, apply]);

  useEffect(() => {
    if (!token) {
      setState(FREE);
      setLoaded(false);
      return undefined;
    }
    refresh();
    const sub = AppState.addEventListener('change', s => s === 'active' && refresh());
    return () => sub.remove();
  }, [token, refresh]);

  const value = {
    ...state,
    loaded,
    refresh,
    apply,
    can: feature => state.features.includes(feature),
    // null → unlimited
    limit: name => (state.limits[name] === undefined ? null : state.limits[name]),
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  return ctx;
}
