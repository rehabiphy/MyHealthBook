import { apiRequest } from './apiClient';

export const interpret = ({ text, pending }, token) => apiRequest('/api/assistant/interpret', { body: { text, pending }, token });
