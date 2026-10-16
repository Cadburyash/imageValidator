"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteImage = exports.getImageById = exports.getImages = exports.uploadImage = void 0;
const uuid_1 = require("uuid");
const index_1 = require("../index");
const multer_1 = require("multer");
const sharp_1 = require("sharp");
const imageValidator_1 = require("../validators/imageValidator");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const uploadImage = async (req, res, next) => {
    try {
        // Validate request
        const { error } = imageValidator_1.imageUploadSchema.safeParse(req.file);
        if (error) {
            throw new Error(`Invalid file: ${error.message}`);
        }
        // Process image with sharp to get metadata
        const imageBuffer = req.file.buffer;
        const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
        // Generate unique filename
        const filename = `${(0, uuid_1.v4)()}.${metadata.format}`;
        // Save file to uploads directory
        const uploadDir = process.env.UPLOAD_DIR || "./uploads";
        const filePath = `${uploadDir}/${filename}`;
        // In a real app, we would save the file here
        // For now, we'll just record the metadata in the database
        // Save image record to database
        const image = await index_1.prisma.image.create({
            data: {
                originalFilename: req.file.originalname,
                storageKey: filename,
                mimeType: req.file.mimetype,
                sizeBytes: req.file.size,
                width: metadata.width ?? undefined,
                height: metadata.height ?? undefined,
                status: "UPLOADED",
            },
        });
        res.status(201).json({
            id: image.id,
            status: image.status,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.uploadImage = uploadImage;
const getImages = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100
        const skip = (page - 1) * limit;
        const [images, totalCount] = await index_1.prisma.$transaction([
            index_1.prisma.image.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            index_1.prisma.image.count(),
        ]);
        res.json({
            images,
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getImages = getImages;
const getImageById = async (req, res, next) => {
    try {
        const imageId = req.params.id;
        const image = await index_1.prisma.image.findUnique({
            where: { id: imageId },
        });
        if (!image) {
            res.status(404).json({ error: "Image not found" });
            return;
        }
        res.json(image);
    }
    catch (error) {
        next(error);
    }
};
exports.getImageById = getImageById;
const deleteImage = async (req, res, next) => {
    try {
        const imageId = req.params.id;
        // Find the image record
        const image = await index_1.prisma.image.findUnique({
            where: { id: imageId },
        });
        if (!image) {
            res.status(404).json({ error: "Image not found" });
            return;
        }
        // Delete the file from filesystem
        const uploadDir = process.env.UPLOAD_DIR || "./uploads";
        const filePath = `${uploadDir}/${image.storageKey}`;
        // In a real app, we would delete the file here
        // const fs = require("fs");
        // fs.unlinkSync(filePath);
        // Delete the image record from database
        await index_1.prisma.image.delete({
            where: { id: imageId },
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
};
exports.deleteImage = deleteImage;
