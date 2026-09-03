import { apiRequest } from './apiClient';

export const getReadings = token => apiRequest('/api/readings', { method: 'GET', token });

export const addBpReading = ({ sys, dia, pulse }, token) => apiRequest('/api/readings/bp', { body: { sys, dia, pulse }, token });

export const addBodyReading = ({ weightKg }, token) => apiRequest('/api/readings/body', { body: { weightKg }, token });

export const addSugarReading = ({ mgdl, kind }, token) => apiRequest('/api/readings/sugar', { body: { mgdl, kind }, token });

export const deleteReading = (type, id, token) => apiRequest(`/api/readings/${type}/${id}`, { method: 'DELETE', token });

export const deleteAllReadings = token => apiRequest('/api/readings', { method: 'DELETE', token });
