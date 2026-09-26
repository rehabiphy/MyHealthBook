import { apiRequest } from './apiClient';

export const sendVerificationEmail = ({ name, email }) => apiRequest('/api/auth/send-verification', { body: { name, email } });

export const verifyEmail = ({ email, token }) => apiRequest('/api/auth/verify-email', { body: { email, token } });

export const checkVerificationStatus = ({ email }) => apiRequest('/api/auth/verification-status', { body: { email } });

export const register = ({ name, username, email, phone, password }) => apiRequest('/api/auth/register', { body: { name, username, email, phone, password } });

export const checkUsername = username => apiRequest(`/api/auth/username-available?username=${encodeURIComponent(username)}`, { method: 'GET' });

export const setUsername = (username, token) => apiRequest('/api/auth/username', { method: 'PATCH', body: { username }, token });

export const login = ({ email, password }) => apiRequest('/api/auth/login', { body: { email, password } });

export const googleSignIn = ({ idToken }) => apiRequest('/api/auth/google', { body: { idToken } });

export const getMe = token => apiRequest('/api/auth/me', { method: 'GET', token });

export const forgotPasswordSendOtp = ({ email }) => apiRequest('/api/auth/forgot-password/send-otp', { body: { email } });

export const forgotPasswordVerifyOtp = ({ email, otp }) => apiRequest('/api/auth/forgot-password/verify-otp', { body: { email, otp } });

export const forgotPasswordReset = ({ email, password }) => apiRequest('/api/auth/forgot-password/reset', { body: { email, password } });
