import { apiRequest } from './apiClient';

export const getNotificationSettings = token => apiRequest('/api/notifications/settings', { method: 'GET', token });

export const updateNotificationSettings = (patch, token) => apiRequest('/api/notifications/settings', { method: 'PATCH', body: patch, token });

/* The in-app list of every push the server has sent this user, newest
   first, a page at a time (`before` = last id of the previous page). */
export const listNotifications = (token, before) => apiRequest(`/api/notifications${before ? `?before=${encodeURIComponent(before)}` : ''}`, { method: 'GET', token });

export const getUnreadCount = token => apiRequest('/api/notifications/unread-count', { method: 'GET', token });

// no ids → marks every notification read
export const markNotificationsRead = (token, ids) => apiRequest('/api/notifications/read', { method: 'POST', body: ids ? { ids } : {}, token });

export const deleteNotification = (id, token) => apiRequest(`/api/notifications/${id}`, { method: 'DELETE', token });

export const clearNotifications = token => apiRequest('/api/notifications', { method: 'DELETE', token });

/* Writes today's AI health tip and pushes it to this user's phones now — for trying it out. */
export const sendHealthTipNow = token => apiRequest('/api/notifications/health-tip', { method: 'POST', body: {}, token });
