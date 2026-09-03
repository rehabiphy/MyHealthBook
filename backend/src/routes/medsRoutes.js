import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import catchAsync from '../utils/catchAsync.js';
import {
  getMedicines,
  createMedicine,
  setMedicineStatus,
  restockMedicine,
  getTaken,
  toggleTaken,
  getSettings,
  updateSettings,
} from '../controllers/medsController.js';

const router = Router();

router.get('/', requireAuth, catchAsync(getMedicines));
router.post('/', requireAuth, catchAsync(createMedicine));
router.patch('/:id/status', requireAuth, catchAsync(setMedicineStatus));
router.patch('/:id/restock', requireAuth, catchAsync(restockMedicine));
router.get('/taken', requireAuth, catchAsync(getTaken));
router.post('/taken', requireAuth, catchAsync(toggleTaken));
router.get('/settings', requireAuth, catchAsync(getSettings));
router.patch('/settings', requireAuth, catchAsync(updateSettings));

export default router;
