import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import { getRecords, createRecord, updateRecord, deleteRecord } from '../controllers/recordsController.js';

const router = Router();

router.get('/', requireAuth, catchAsync(getRecords));
router.post('/', requireAuth, catchAsync(createRecord));
router.patch('/:id', requireAuth, catchAsync(updateRecord));
router.delete('/:id', requireAuth, catchAsync(deleteRecord));

export default router;
