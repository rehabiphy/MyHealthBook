import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import familyAccess from '../middleware/familyAccess.js';
import catchAsync from '../utils/catchAsync.js';
import {
  getMedicines,
  createMedicine,
  setMedicineStatus,
  restockMedicine,
  deleteMedicine,
  getTaken,
  toggleTaken,
  getSettings,
  updateSettings,
  searchCatalog,
} from '../controllers/medsController.js';

const router = Router();
const shared = familyAccess('medicines');

router.get('/', requireAuth, shared, catchAsync(getMedicines));
// the catalog is global reference data, not anyone's record — no family check needed
router.get('/catalog', requireAuth, catchAsync(searchCatalog));
router.post('/', requireAuth, shared, catchAsync(createMedicine));
router.patch('/:id/status', requireAuth, shared, catchAsync(setMedicineStatus));
router.patch('/:id/restock', requireAuth, shared, catchAsync(restockMedicine));
router.delete('/:id', requireAuth, shared, catchAsync(deleteMedicine));
router.get('/taken', requireAuth, shared, catchAsync(getTaken));
router.post('/taken', requireAuth, shared, catchAsync(toggleTaken));
router.get('/settings', requireAuth, shared, catchAsync(getSettings));
router.patch('/settings', requireAuth, shared, catchAsync(updateSettings));

export default router;
