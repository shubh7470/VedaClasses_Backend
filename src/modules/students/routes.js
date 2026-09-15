import { Router } from 'express';
import {
  createStudent,
  listStudents,
  getStudentById,
  updateStudent,
  upgradeStudent,
} from './controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { checkPermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { PERMISSIONS } from '../../common/constants/roles.js';
import {
  createStudentSchema,
  updateStudentSchema,
  listStudentsSchema,
  upgradeStudentSchema,
} from './validation.js';

const router = Router();

// Protect all admin student routes
router.use(authenticate);

// Create Regular Student
router.post(
  '/',
  checkPermission(PERMISSIONS.STUDENT_CREATE),
  validateRequest(createStudentSchema),
  createStudent
);

// List Students with filtering (by status, studentType, search)
router.post(
  '/:id/upgrade',
  checkPermission(PERMISSIONS.STUDENT_UPDATE),
  validateRequest(upgradeStudentSchema),
  upgradeStudent
);

router.get(
  '/',
  checkPermission(PERMISSIONS.STUDENT_READ),
  validateRequest(listStudentsSchema),
  listStudents
);

// Get single student
router.get('/:id', checkPermission(PERMISSIONS.STUDENT_READ), getStudentById);

// Update student
router.patch(
  '/:id',
  checkPermission(PERMISSIONS.STUDENT_UPDATE),
  validateRequest(updateStudentSchema),
  updateStudent
);

export default router;
