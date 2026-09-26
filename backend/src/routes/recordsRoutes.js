import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import familyAccess from '../middleware/familyAccess.js';
import catchAsync from '../utils/catchAsync.js';
import { getRecords, createRecord, updateRecord, deleteRecord } from '../controllers/recordsController.js';

const router = Router();
const shared = familyAccess('records');

router.get('/', requireAuth, shared, catchAsync(getRecords));
router.post('/', requireAuth, shared, catchAsync(createRecord));
router.patch('/:id', requireAuth, shared, catchAsync(updateRecord));
router.delete('/:id', requireAuth, shared, catchAsync(deleteRecord));

export default router;
