import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import familyAccess from '../middleware/familyAccess.js';
import catchAsync from '../utils/catchAsync.js';
import { getFamily, lookupUser, invite, acceptInvite, removeLink, updateScopes } from '../controllers/familyController.js';

const router = Router();

// managing links is always done as yourself, never on someone's behalf
router.use(requireAuth, familyAccess(null));

router.get('/', catchAsync(getFamily));
router.get('/lookup', catchAsync(lookupUser));
router.post('/invite', catchAsync(invite));
router.post('/:id/accept', catchAsync(acceptInvite));
router.patch('/:id', catchAsync(updateScopes));
router.delete('/:id', catchAsync(removeLink));

export default router;
