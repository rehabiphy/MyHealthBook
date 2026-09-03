import { apiRequest } from './apiClient';

export const sendVerificationEmail = ({ name, email }) => apiRequest('/api/auth/send-verification', { body: { name, email } });

export const verifyEmail = ({ email, otp }) => apiRequest('/api/auth/verify-email', { body: { email, otp } });

export const register = ({ name, email, phone, password }) => apiRequest('/api/auth/register', { body: { name, email, phone, password } });

export const login = ({ email, password }) => apiRequest('/api/auth/login', { body: { email, password } });

export const getMe = token => apiRequest('/api/auth/me', { method: 'GET', token });

export const forgotPasswordSendOtp = ({ email }) => apiRequest('/api/auth/forgot-password/send-otp', { body: { email } });

export const forgotPasswordVerifyOtp = ({ email, otp }) => apiRequest('/api/auth/forgot-password/verify-otp', { body: { email, otp } });

export const forgotPasswordReset = ({ email, password }) => apiRequest('/api/auth/forgot-password/reset', { body: { email, password } });
