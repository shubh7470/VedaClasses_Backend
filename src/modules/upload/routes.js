import { Router } from 'express';
import { uploadImageController, deleteImageController } from './controller.js';

const router = Router();

router.post('/image', uploadImageController);
router.post('/delete', deleteImageController);

export default router;

