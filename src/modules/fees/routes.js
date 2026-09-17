import { Router } from 'express';
import {
  createFeeStructure,
  getStudentFeeDetails,
  recordPayment,
  getDashboardSummary,
  listStudentFees,
} from './controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { checkPermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { PERMISSIONS } from '../../common/constants/roles.js';
import {
  createFeeStructureSchema,
  recordPaymentSchema,
  listStudentFeesSchema,
} from './validation.js';

const router = Router();

router.use(authenticate);

router.post(
  '/structures',
  checkPermission(PERMISSIONS.FEE_CREATE),
  validateRequest(createFeeStructureSchema),
  createFeeStructure
);

router.get(
  '/structures/:studentId',
  checkPermission(PERMISSIONS.FEE_READ),
  getStudentFeeDetails
);

router.post(
  '/payments',
  checkPermission(PERMISSIONS.PAYMENT_CREATE),
  validateRequest(recordPaymentSchema),
  recordPayment
);

router.get(
  '/dashboard-summary',
  checkPermission(PERMISSIONS.FEE_READ),
  getDashboardSummary
);

router.get(
  '/students',
  checkPermission(PERMISSIONS.FEE_READ),
  validateRequest(listStudentFeesSchema),
  listStudentFees
);

export default router;
