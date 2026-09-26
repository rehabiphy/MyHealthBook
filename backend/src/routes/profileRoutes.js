import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import familyAccess from '../middleware/familyAccess.js';
import catchAsync from '../utils/catchAsync.js';
import { getProfile, updateProfile, updateHealth } from '../controllers/profileController.js';

const router = Router();

// name/age/height are needed to show any shared section (BMI, headers), so any accepted share can read them
router.get('/', requireAuth, familyAccess('any'), catchAsync(getProfile));
router.patch('/', requireAuth, familyAccess('health'), catchAsync(updateProfile));
router.patch('/health', requireAuth, familyAccess('health'), catchAsync(updateHealth));

export default router;
