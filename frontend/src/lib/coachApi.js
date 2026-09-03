import { apiRequest } from './apiClient';

export const sendMessage = ({ messages }, token) => apiRequest('/api/coach', { body: { messages }, token });
