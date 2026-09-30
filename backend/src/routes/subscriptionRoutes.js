import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import familyAccess from '../middleware/familyAccess.js';
import catchAsync from '../utils/catchAsync.js';
import { getSubscription, cancelSubscription, resumeSubscription, restorePurchases, recordEvent } from '../controllers/subscriptionController.js';

const router = Router();

// a subscription is always your own — never managed on a family member's behalf
router.use(requireAuth, familyAccess(null));

router.get('/', catchAsync(getSubscription));
router.post('/cancel', catchAsync(cancelSubscription));
router.post('/resume', catchAsync(resumeSubscription));
router.post('/restore', catchAsync(restorePurchases));
router.post('/events', catchAsync(recordEvent));

export default router;
