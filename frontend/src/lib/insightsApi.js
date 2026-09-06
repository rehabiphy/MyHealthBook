import { apiRequest } from './apiClient';

export const generateInsights = token => apiRequest('/api/insights', { method: 'POST', token });
