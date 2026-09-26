import { apiRequest } from './apiClient';

// sections of a record that can be shared — sharing one grants view + edit
export const FAMILY_SCOPES = [
  { key: 'readings', label: 'Readings', hint: 'Blood pressure, sugar, weight' },
  { key: 'medicines', label: 'Medicines', hint: 'Medicines and doses taken' },
  { key: 'records', label: 'Records', hint: 'Medical history and reports' },
  { key: 'health', label: 'Health', hint: 'Conditions, allergies, blood group' },
];

export const scopeLabel = key => FAMILY_SCOPES.find(s => s.key === key)?.label || key;

export const getFamily = token => apiRequest('/api/family', { method: 'GET', token });

export const lookupUser = (username, token) => apiRequest(`/api/family/lookup?username=${encodeURIComponent(username)}`, { method: 'GET', token });

export const invite = ({ username, scopes }, token) => apiRequest('/api/family/invite', { body: { username, scopes }, token });

export const acceptInvite = (id, token) => apiRequest(`/api/family/${id}/accept`, { token });

// declining an invite, leaving someone's family, and removing a member are all the same call
export const removeLink = (id, token) => apiRequest(`/api/family/${id}`, { method: 'DELETE', token });

export const updateScopes = (id, scopes, token) => apiRequest(`/api/family/${id}`, { method: 'PATCH', body: { scopes }, token });
