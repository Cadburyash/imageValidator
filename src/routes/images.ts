import { Router } from "express";
import { 
  uploadImage, 
  getImages, 
  getImageById, 
  deleteImage 
} from "../controllers/imageController";
import multer from "multer";

const router = Router();

// Configure multer for the upload route
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/v1/images
router.post("/", upload.single("image"), uploadImage);

// GET /api/v1/images
router.get("/", getImages);

// GET /api/v1/images/:id
router.get("/:id", getImageById);

// DELETE /api/v1/images/:id
router.delete("/:id", deleteImage);

export { router as imageRouter };
