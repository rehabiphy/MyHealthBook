import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import { getNotificationSettings, updateNotificationSettings, sendHealthTipNow } from '../controllers/notificationsController.js';

const router = Router();

router.use(requireAuth);

router.get('/settings', catchAsync(getNotificationSettings));
router.patch('/settings', catchAsync(updateNotificationSettings));
router.post('/health-tip', catchAsync(sendHealthTipNow));

export default router;
