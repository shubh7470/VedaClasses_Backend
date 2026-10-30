import { Router } from 'express';
import { createLead, listLeads, updateLeadStatus } from './controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/permission.middleware.js';
import { ROLES } from '../../common/constants/roles.js';

const router = Router();

// Public: Book a Free Demo / Website Enquiry
router.post('/', createLead);
router.post('/demo', createLead);

// Admin: View and manage leads
router.get('/', authenticate, authorize(ROLES.ADMIN, ROLES.TEACHER), listLeads);
router.patch('/:id/status', authenticate, authorize(ROLES.ADMIN), updateLeadStatus);

export default router;

