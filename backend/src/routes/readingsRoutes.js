import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import familyAccess from '../middleware/familyAccess.js';
import catchAsync from '../utils/catchAsync.js';
import { getReadings, createBpReading, createBodyReading, createSugarReading, deleteReading, deleteAllReadings } from '../controllers/readingsController.js';

const router = Router();
const shared = familyAccess('readings');

router.get('/', requireAuth, shared, catchAsync(getReadings));
router.post('/bp', requireAuth, shared, catchAsync(createBpReading));
router.post('/body', requireAuth, shared, catchAsync(createBodyReading));
router.post('/sugar', requireAuth, shared, catchAsync(createSugarReading));
router.delete('/:type/:id', requireAuth, shared, catchAsync(deleteReading));
// wiping everything stays with the owner alone
router.delete('/', requireAuth, familyAccess(null), catchAsync(deleteAllReadings));

export default router;
