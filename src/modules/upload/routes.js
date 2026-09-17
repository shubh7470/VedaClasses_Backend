import { Router } from 'express';
import { uploadImageController } from './controller.js';

const router = Router();

router.post('/image', uploadImageController);

export default router;
