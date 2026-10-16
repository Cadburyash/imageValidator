"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteImage = exports.getImageById = exports.getImages = exports.uploadImage = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const multer_1 = __importDefault(require("multer"));
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = require("crypto");
const sharp_phash_1 = __importDefault(require("sharp-phash"));
function calculateHammingDistance(hash1, hash2) {
    if (hash1.length !== hash2.length) {
        return Number.MAX_SAFE_INTEGER;
    }
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) {
            distance++;
        }
    }
    return distance;
}
async function calculateBlurScore(imageBuffer) {
    const laplacian = await (0, sharp_1.default)(imageBuffer)
        .greyscale()
        .convolve({
        width: 3,
        height: 3,
        kernel: [
            0, 1, 0,
            1, -4, 1,
            0, 1, 0,
        ],
    })
        .raw()
        .toBuffer();
    const mean = laplacian.reduce((sum, value) => sum + value, 0) /
        laplacian.length;
    const variance = laplacian.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / laplacian.length;
    return variance;
}
const maxFileSize = Number(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024;
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: maxFileSize,
    },
    fileFilter: (_req, file, callback) => {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/heic',
            'image/heif',
        ];
        if (!allowedTypes.includes(file.mimetype)) {
            callback(new Error('Only JPEG, PNG, HEIC and HEIF images are allowed'));
            return;
        }
        callback(null, true);
    },
});
const uploadDir = path_1.default.resolve(process.env.UPLOAD_DIR || 'uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// POST /api/v1/images
const uploadImage = (req, res, next) => {
    upload.single('image')(req, res, async (uploadError) => {
        try {
            if (uploadError) {
                const message = uploadError instanceof Error
                    ? uploadError.message
                    : 'Image upload failed';
                return res.status(400).json({ error: message });
            }
            if (!req.file) {
                return res.status(400).json({
                    error: 'No image file provided',
                });
            }
            const file = req.file;
            let faceValidation = null;
            try {
                const rawFaceValidation = req.body?.faceValidation;
                if (typeof rawFaceValidation === 'string') {
                    faceValidation = JSON.parse(rawFaceValidation);
                }
            }
            catch {
                return res.status(400).json({
                    error: 'Invalid face validation data',
                });
            }
            console.log('Backend received face validation:', faceValidation);
            let perceptualHash = null;
            let width = null;
            let height = null;
            let status = client_1.Status.UPLOADED;
            let rejectionReasons = [];
            try {
                const metadata = await (0, sharp_1.default)(file.buffer).metadata();
                perceptualHash = await (0, sharp_phash_1.default)(file.buffer);
                const blurScore = await calculateBlurScore(file.buffer);
                console.log('Image blur score:', blurScore);
                const BLUR_THRESHOLD = 50;
                if (blurScore < BLUR_THRESHOLD) {
                    status = client_1.Status.REJECTED;
                    rejectionReasons.push(`Image appears blurry (score: ${blurScore.toFixed(2)})`);
                }
                const existingImages = await prisma_1.prisma.image.findMany({
                    where: {
                        perceptualHash: {
                            not: null,
                        },
                        status: {
                            in: [client_1.Status.UPLOADED, client_1.Status.ACCEPTED],
                        },
                    },
                    select: {
                        id: true,
                        originalFilename: true,
                        perceptualHash: true,
                    },
                });
                const SIMILARITY_THRESHOLD = 10;
                for (const existingImage of existingImages) {
                    if (!existingImage.perceptualHash) {
                        continue;
                    }
                    const distance = calculateHammingDistance(perceptualHash, existingImage.perceptualHash);
                    if (distance <= SIMILARITY_THRESHOLD) {
                        status = client_1.Status.REJECTED;
                        rejectionReasons.push(`Image is too similar to an existing image: ${existingImage.originalFilename}`);
                        break;
                    }
                }
                width = metadata.width ?? null;
                height = metadata.height ?? null;
                const format = metadata.format?.toLowerCase();
                const supportedFormats = ['jpeg', 'png', 'heif'];
                if (!format || !supportedFormats.includes(format)) {
                    status = client_1.Status.REJECTED;
                    rejectionReasons.push(`Unsupported image format: ${format || 'unknown'}`);
                }
                // Basic resolution validation.
                if (!width || !height || width < 100 || height < 100) {
                    status = client_1.Status.REJECTED;
                    rejectionReasons.push('Image resolution is too small');
                }
            }
            catch (error) {
                status = client_1.Status.REJECTED;
                rejectionReasons.push('Invalid, corrupted, or unsupported image file');
                console.error('Image validation failed:', error);
            }
            if (faceValidation) {
                if (faceValidation.faceCount > 1) {
                    status = client_1.Status.REJECTED;
                    rejectionReasons.push('Multiple faces detected');
                }
                if (faceValidation.facesTooSmall) {
                    status = client_1.Status.REJECTED;
                    rejectionReasons.push('Detected face is too small');
                }
            }
            console.log('Final status after face validation:', status);
            console.log('Final rejection reasons:', rejectionReasons);
            const extension = path_1.default.extname(file.originalname);
            const storageKey = `${(0, crypto_1.randomUUID)()}${extension}`;
            const filePath = path_1.default.join(uploadDir, storageKey);
            await fs_1.default.promises.writeFile(filePath, file.buffer);
            let image;
            try {
                image = await prisma_1.prisma.image.create({
                    data: {
                        originalFilename: file.originalname,
                        storageKey,
                        mimeType: file.mimetype,
                        sizeBytes: file.size,
                        width,
                        height,
                        perceptualHash,
                        status,
                        rejectionReasons: rejectionReasons.length > 0
                            ? rejectionReasons
                            : client_1.Prisma.JsonNull,
                    },
                });
            }
            catch (databaseError) {
                // Avoid leaving an uploaded file behind if saving the
                // database record fails.
                await fs_1.default.promises.unlink(filePath).catch(() => { });
                throw databaseError;
            }
            return res.status(201).json({
                id: image.id,
                status: image.status,
                originalFilename: image.originalFilename,
                mimeType: image.mimeType,
                sizeBytes: image.sizeBytes,
                width: image.width,
                height: image.height,
                rejectionReasons: image.rejectionReasons,
            });
        }
        catch (error) {
            next(error);
        }
    });
};
exports.uploadImage = uploadImage;
// GET /api/v1/images
const getImages = async (req, res, next) => {
    try {
        const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100);
        const skip = (page - 1) * limit;
        const [images, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.image.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.image.count(),
        ]);
        return res.json({
            data: images,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getImages = getImages;
// GET /api/v1/images/:id
const getImageById = async (req, res, next) => {
    try {
        const image = await prisma_1.prisma.image.findUnique({
            where: { id: req.params.id },
        });
        if (!image) {
            return res.status(404).json({
                error: 'Image not found',
            });
        }
        return res.json(image);
    }
    catch (error) {
        next(error);
    }
};
exports.getImageById = getImageById;
// DELETE /api/v1/images/:id
const deleteImage = async (req, res, next) => {
    try {
        const image = await prisma_1.prisma.image.findUnique({
            where: { id: req.params.id },
        });
        if (!image) {
            return res.status(404).json({
                error: 'Image not found',
            });
        }
        const filePath = path_1.default.join(uploadDir, image.storageKey);
        await prisma_1.prisma.image.delete({
            where: { id: req.params.id },
        });
        try {
            await fs_1.default.promises.unlink(filePath);
        }
        catch (error) {
            console.warn('Could not delete image file:', error);
        }
        return res.status(204).send();
    }
    catch (error) {
        next(error);
    }
};
exports.deleteImage = deleteImage;
