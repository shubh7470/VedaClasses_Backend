import { Router } from 'express';
import {
  listGalleryItems,
  createGalleryItem,
  deleteGalleryItem,
  updateGalleryItem,
} from './controller.js';

const router = Router();

router.get('/', listGalleryItems);
router.post('/', createGalleryItem);
router.delete('/:id', deleteGalleryItem);
router.put('/:id', updateGalleryItem);

export default router;
