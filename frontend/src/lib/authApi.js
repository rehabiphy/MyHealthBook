import { apiRequest } from './apiClient';

export const sendVerificationEmail = ({ name, email }) => apiRequest('/api/auth/send-verification', { body: { name, email } });

export const verifyEmail = ({ email, token }) => apiRequest('/api/auth/verify-email', { body: { email, token } });

export const checkVerificationStatus = ({ email }) => apiRequest('/api/auth/verification-status', { body: { email } });

export const register = ({ name, email, phone, password }) => apiRequest('/api/auth/register', { body: { name, email, phone, password } });

export const login = ({ email, password }) => apiRequest('/api/auth/login', { body: { email, password } });

export const getMe = token => apiRequest('/api/auth/me', { method: 'GET', token });
