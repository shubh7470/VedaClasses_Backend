import { Router } from 'express';
import {
  getSelfProfile,
  getSelfFees,
  getSelfAttendance,
  getSelfTests,
} from './controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

// Strict rule: All self-service routes require authentication and NEVER take arbitrary IDs from body/query
router.use(authenticate);

router.get('/', getSelfProfile);
router.get('/fees', getSelfFees);
router.get('/attendance', getSelfAttendance);
router.get('/tests', getSelfTests);

export default router;
