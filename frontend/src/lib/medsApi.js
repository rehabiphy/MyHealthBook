import { apiRequest } from './apiClient';

export const getMedicines = token => apiRequest('/api/meds', { method: 'GET', token });

/* Reference list of ~254k Indian medicines, searched and paged server-side. */
export const searchMedicineCatalog = ({ q = '', page = 1, limit = 20 } = {}, token) =>
  apiRequest(`/api/meds/catalog?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`, { method: 'GET', token });

export const createMedicine =(fields, token) => apiRequest('/api/meds', { body: fields, token });

export const setMedicineStatus = (id, status, reason, token) => apiRequest(`/api/meds/${id}/status`, { method: 'PATCH', body: { status, reason }, token });

export const deleteMedicine = (id, token) => apiRequest(`/api/meds/${id}`, { method: 'DELETE', token });

export const restockMedicine = (id, qty, token) => apiRequest(`/api/meds/${id}/restock`, { method: 'PATCH', body: { qty }, token });

export const getTaken = ({ from, to } = {}, token) =>
  apiRequest(`/api/meds/taken${from && to ? `?from=${from}&to=${to}` : ''}`, { method: 'GET', token });

export const toggleTaken = ({ medId, slotKey, day }, token) => apiRequest('/api/meds/taken', { body: { medId, slotKey, day }, token });

export const getMedSettings = token => apiRequest('/api/meds/settings', { method: 'GET', token });

export const updateMedSettings = (patch, token) => apiRequest('/api/meds/settings', { method: 'PATCH', body: patch, token });
