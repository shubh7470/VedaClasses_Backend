import { Router } from 'express';
import {
  createBatch,
  listBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
} from './controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { checkPermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { PERMISSIONS } from '../../common/constants/roles.js';
import {
  createBatchSchema,
  updateBatchSchema,
  listBatchesSchema,
} from './validation.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  checkPermission(PERMISSIONS.BATCH_CREATE),
  validateRequest(createBatchSchema),
  createBatch
);

router.get(
  '/',
  checkPermission(PERMISSIONS.BATCH_READ),
  validateRequest(listBatchesSchema),
  listBatches
);

router.get('/:id', checkPermission(PERMISSIONS.BATCH_READ), getBatchById);

router.patch(
  '/:id',
  checkPermission(PERMISSIONS.BATCH_UPDATE),
  validateRequest(updateBatchSchema),
  updateBatch
);

router.delete('/:id', checkPermission(PERMISSIONS.BATCH_DELETE), deleteBatch);

export default router;
