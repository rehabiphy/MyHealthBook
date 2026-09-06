import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import { initiateCheckout, handlePayuCallback } from '../controllers/paymentController.js';

const router = Router();

router.post('/checkout', requireAuth, catchAsync(initiateCheckout));
// Public — PayU posts these directly, no bearer token available.
router.post('/payu-success', catchAsync(handlePayuCallback));
router.post('/payu-failure', catchAsync(handlePayuCallback));

export default router;
