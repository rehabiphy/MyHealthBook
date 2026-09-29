import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import familyAccess from '../middleware/familyAccess.js';
import catchAsync from '../utils/catchAsync.js';
import { getRecords, createRecord, updateRecord, deleteRecord, getUploadUrl, getAttachmentUrl } from '../controllers/recordsController.js';

const router = Router();
const shared = familyAccess('records');

router.get('/', requireAuth, shared, catchAsync(getRecords));
router.post('/', requireAuth, shared, catchAsync(createRecord));
router.post('/attachments/upload-url', requireAuth, shared, catchAsync(getUploadUrl));
router.get('/:id/attachment', requireAuth, shared, catchAsync(getAttachmentUrl));
router.patch('/:id', requireAuth, shared, catchAsync(updateRecord));
router.delete('/:id', requireAuth, shared, catchAsync(deleteRecord));

export default router;
