"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageRouter = void 0;
const express_1 = require("express");
const imageController_1 = require("../controllers/imageController");
const multer_1 = require("multer");
const router = (0, express_1.Router)();
exports.imageRouter = router;
// Configure multer for the upload route
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// POST /api/v1/images
router.post("/", upload.single("image"), imageController_1.uploadImage);
// GET /api/v1/images
router.get("/", imageController_1.getImages);
// GET /api/v1/images/:id
router.get("/:id", imageController_1.getImageById);
// DELETE /api/v1/images/:id
router.delete("/:id", imageController_1.deleteImage);
