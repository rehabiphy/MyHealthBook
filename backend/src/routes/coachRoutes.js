import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import { sendMessage } from '../controllers/coachController.js';

const router = Router();

router.post('/', requireAuth, catchAsync(sendMessage));

export default router;
