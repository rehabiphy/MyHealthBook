import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import aiRateLimit from '../middleware/aiRateLimit.js';
import catchAsync from '../utils/catchAsync.js';
import { generateInsights } from '../controllers/insightsController.js';

const router = Router();

router.post('/', requireAuth, aiRateLimit, catchAsync(generateInsights));

export default router;
