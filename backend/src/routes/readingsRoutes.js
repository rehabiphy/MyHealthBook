import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import { getReadings, createBpReading, createBodyReading, createSugarReading, deleteReading, deleteAllReadings } from '../controllers/readingsController.js';

const router = Router();

router.get('/', requireAuth, catchAsync(getReadings));
router.post('/bp', requireAuth, catchAsync(createBpReading));
router.post('/body', requireAuth, catchAsync(createBodyReading));
router.post('/sugar', requireAuth, catchAsync(createSugarReading));
router.delete('/:type/:id', requireAuth, catchAsync(deleteReading));
router.delete('/', requireAuth, catchAsync(deleteAllReadings));

export default router;
