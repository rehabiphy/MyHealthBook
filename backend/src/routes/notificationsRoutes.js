import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendHealthTipNow,
  listNotifications,
  unreadCount,
  markRead,
  deleteNotification,
  clearNotifications,
} from '../controllers/notificationsController.js';

const router = Router();

router.use(requireAuth);

router.get('/settings', catchAsync(getNotificationSettings));
router.patch('/settings', catchAsync(updateNotificationSettings));
router.post('/health-tip', catchAsync(sendHealthTipNow));

router.get('/', catchAsync(listNotifications));
router.delete('/', catchAsync(clearNotifications));
router.get('/unread-count', catchAsync(unreadCount));
router.post('/read', catchAsync(markRead));
router.delete('/:id', catchAsync(deleteNotification));

export default router;
