import { apiRequest } from './apiClient';

export const registerFcmToken = ({ token }, authToken) => apiRequest('/api/auth/fcm-token', { body: { token }, token: authToken });
export const removeFcmToken = ({ token }, authToken) => apiRequest('/api/auth/fcm-token', { method: 'DELETE', body: { token }, token: authToken });
