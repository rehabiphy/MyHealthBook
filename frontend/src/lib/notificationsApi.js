import { apiRequest } from './apiClient';

export const getNotificationSettings = token => apiRequest('/api/notifications/settings', { method: 'GET', token });

export const updateNotificationSettings = (patch, token) => apiRequest('/api/notifications/settings', { method: 'PATCH', body: patch, token });

/* Writes today's AI health tip and pushes it to this user's phones now — for trying it out. */
export const sendHealthTipNow = token => apiRequest('/api/notifications/health-tip', { method: 'POST', body: {}, token });
