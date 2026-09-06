import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import { generateInsights } from '../controllers/insightsController.js';

const router = Router();

router.post('/', requireAuth, catchAsync(generateInsights));

export default router;
