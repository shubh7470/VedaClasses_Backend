import { Router } from 'express';
import {
  createCourse,
  listCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} from './controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { checkPermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { PERMISSIONS } from '../../common/constants/roles.js';
import {
  createCourseSchema,
  updateCourseSchema,
  listCoursesSchema,
} from './validation.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  checkPermission(PERMISSIONS.COURSE_CREATE),
  validateRequest(createCourseSchema),
  createCourse
);

router.get(
  '/',
  checkPermission(PERMISSIONS.COURSE_READ),
  validateRequest(listCoursesSchema),
  listCourses
);

router.get('/:id', checkPermission(PERMISSIONS.COURSE_READ), getCourseById);

router.patch(
  '/:id',
  checkPermission(PERMISSIONS.COURSE_UPDATE),
  validateRequest(updateCourseSchema),
  updateCourse
);

router.delete('/:id', checkPermission(PERMISSIONS.COURSE_DELETE), deleteCourse);

export default router;
