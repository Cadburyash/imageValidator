import { Router } from 'express';
import {
  uploadImage,
  getImages,
  getImageById,
  deleteImage,
} from '../controllers/imageController';

const router = Router();

router.post('/', uploadImage);
router.get('/', getImages);
router.get('/:id', getImageById);
router.delete('/:id', deleteImage);

export { router as imageRouter };