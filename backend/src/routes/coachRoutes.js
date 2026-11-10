import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import aiRateLimit from '../middleware/aiRateLimit.js';
import catchAsync from '../utils/catchAsync.js';
import { sendMessage } from '../controllers/coachController.js';

const router = Router();

router.post('/', requireAuth, aiRateLimit, catchAsync(sendMessage));

export default router;
