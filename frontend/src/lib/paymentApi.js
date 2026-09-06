import { apiRequest } from './apiClient';

export const initiateCheckout = ({ plan }, token) => apiRequest('/api/payments/checkout', { body: { plan }, token });
