import { apiRequest } from './apiClient';

export const getProfile = token => apiRequest('/api/profile', { method: 'GET', token });

export const updateProfile = (patch, token) => apiRequest('/api/profile', { method: 'PATCH', body: patch, token });


export const updateHealth = (patch, token) => apiRequest('/api/profile/health', { method: 'PATCH', body: patch, token });
