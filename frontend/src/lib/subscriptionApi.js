import { apiRequest } from './apiClient';

export const getSubscription = token => apiRequest('/api/subscription', { method: 'GET', token });
export const cancelSubscription = token => apiRequest('/api/subscription/cancel', { token });
export const resumeSubscription = token => apiRequest('/api/subscription/resume', { token });
export const restorePurchases = token => apiRequest('/api/subscription/restore', { token });

// funnel analytics — best-effort, never worth an error on screen
export const trackEvent = (event, plan, token) => apiRequest('/api/subscription/events', { body: { event, plan }, token }).catch(() => {});
