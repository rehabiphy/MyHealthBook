import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import { raiseSos, cancelSos, ackSos, getSos, getActiveSos } from '../controllers/sosController.js';

const router = Router();

router.use(requireAuth);

router.post('/', catchAsync(raiseSos));
router.get('/active', catchAsync(getActiveSos));
router.get('/:id', catchAsync(getSos));
router.post('/:id/cancel', catchAsync(cancelSos));
router.post('/:id/ack', catchAsync(ackSos));

export default router;
