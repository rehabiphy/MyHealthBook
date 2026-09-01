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
} from '../controllers/authController.js';

const router = Router();

router.post('/send-verification', catchAsync(sendVerification));
router.post('/verify-email', catchAsync(verifyEmail));
router.post('/verification-status', catchAsync(checkVerificationStatus));
router.post('/register', catchAsync(register));
router.post('/login', catchAsync(login));
router.get('/me', requireAuth, catchAsync(getMe));

export default router;
