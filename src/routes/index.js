import { Router } from 'express';
import authRoutes from '../modules/auth/routes.js';
import studentRoutes from '../modules/students/routes.js';
import meRoutes from '../modules/students/me.routes.js';
import courseRoutes from '../modules/courses/routes.js';
import batchRoutes from '../modules/batches/routes.js';

const router = Router();

// Health Check API
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Coaching Management API is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Phase 1 Domain Routes
router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.use('/students', studentRoutes);
router.use('/courses', courseRoutes);
router.use('/batches', batchRoutes);
// router.use('/users', userRoutes);
// router.use('/teachers', teacherRoutes);
// router.use('/enrollments', enrollmentRoutes);

export default router;
