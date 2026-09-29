import { apiRequest } from './apiClient';

export const getRecords = token => apiRequest('/api/records', { method: 'GET', token });

export const createRecord = (fields, token) => apiRequest('/api/records', { body: fields, token });

export const updateRecord = (id, patch, token) => apiRequest(`/api/records/${id}`, { method: 'PATCH', body: patch, token });

export const deleteRecord = (id, token) => apiRequest(`/api/records/${id}`, { method: 'DELETE', token });

/* Report files live in S3 — see lib/attachments.js. */
export const getUploadUrl = ({ type, size }, token) => apiRequest('/api/records/attachments/upload-url', { body: { type, size }, token });

export const getAttachmentUrl = (id, token) => apiRequest(`/api/records/${id}/attachment`, { method: 'GET', token });
