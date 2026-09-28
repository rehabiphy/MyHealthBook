import { apiRequest } from './apiClient';

// trigger: 'fall' | 'manual'
export const raiseSos = (trigger, token) => apiRequest('/api/sos', { body: { trigger }, token });
export const cancelSos = (id, token) => apiRequest(`/api/sos/${id}/cancel`, { token });
// action: 'silenced' | 'dismissed' — only affects the caller's own phone
export const ackSos = (id, action, token) => apiRequest(`/api/sos/${id}/ack`, { body: { action }, token });
export const getSos = (id, token) => apiRequest(`/api/sos/${id}`, { method: 'GET', token });
export const getActiveSos = token => apiRequest('/api/sos/active', { method: 'GET', token });
