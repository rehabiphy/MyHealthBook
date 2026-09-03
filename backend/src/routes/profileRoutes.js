import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import { getProfile, updateProfile, setCareRole, updateHealth } from '../controllers/profileController.js';

const router = Router();

router.get('/', requireAuth, catchAsync(getProfile));
router.patch('/', requireAuth, catchAsync(updateProfile));
router.patch('/care', requireAuth, catchAsync(setCareRole));
router.patch('/health', requireAuth, catchAsync(updateHealth));

export default router;
