import { apiRequest } from './apiClient';

/* Sends the phone's UTC offset along (minutes east, IST = 330) so the
   server's daily health tip arrives by the user's own clock. */
export const registerFcmToken = ({ token }, authToken) =>
  apiRequest('/api/auth/fcm-token', { body: { token, tzOffsetMin: -new Date().getTimezoneOffset() }, token: authToken });
export const removeFcmToken = ({ token }, authToken) => apiRequest('/api/auth/fcm-token', { method: 'DELETE', body: { token }, token: authToken });
