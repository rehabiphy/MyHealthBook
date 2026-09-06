import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import {
  sendVerification,
  verifyEmail,
  checkVerificationStatus,
  register,
  login,
  getMe,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  registerFcmToken,
  removeFcmToken,
} from '../controllers/authController.js';
import { googleSignIn } from '../controllers/googleAuthController.js';

const router = Router();

router.post('/send-verification', catchAsync(sendVerification));
router.post('/verify-email', catchAsync(verifyEmail));
router.post('/verification-status', catchAsync(checkVerificationStatus));
router.post('/register', catchAsync(register));
router.post('/login', catchAsync(login));
router.post('/google', catchAsync(googleSignIn));
router.get('/me', requireAuth, catchAsync(getMe));
router.post('/fcm-token', requireAuth, catchAsync(registerFcmToken));
router.delete('/fcm-token', requireAuth, catchAsync(removeFcmToken));

router.post('/forgot-password/send-otp', catchAsync(forgotPasswordSendOtp));
router.post('/forgot-password/verify-otp', catchAsync(forgotPasswordVerifyOtp));
router.post('/forgot-password/reset', catchAsync(forgotPasswordReset));

export default router;
