import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import {
  sendVerification,
  verifyEmail,
  register,
  login,
  getMe,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
} from '../controllers/authController.js';

const router = Router();

router.post('/send-verification', catchAsync(sendVerification));
router.post('/verify-email', catchAsync(verifyEmail));
router.post('/register', catchAsync(register));
router.post('/login', catchAsync(login));
router.get('/me', requireAuth, catchAsync(getMe));

router.post('/forgot-password/send-otp', catchAsync(forgotPasswordSendOtp));
router.post('/forgot-password/verify-otp', catchAsync(forgotPasswordVerifyOtp));
router.post('/forgot-password/reset', catchAsync(forgotPasswordReset));

export default router;
