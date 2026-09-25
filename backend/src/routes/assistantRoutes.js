import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import { interpret } from '../controllers/assistantController.js';

const router = Router();

router.post('/interpret', requireAuth, catchAsync(interpret));

export default router;
