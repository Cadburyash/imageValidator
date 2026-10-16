import { prisma } from '../index';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';
// Configure multer for memory storage (we'll process the file with sharp and then save to disk)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: Number(process.env.MAX_FILE_SIZE_MB) * 1024 * 1024 || 10 * 1024 * 1024 // Default 10MB
    },
    fileFilter: (req, file, cb) => {
        // We'll also do validation in the validator, but we can do a basic check here
        if (!file.mimetype.match(/image\/(jpeg|png|heic|heif)/)) {
            req.fileFormatError = true;
            return cb(null, false);
        }
        cb(null, true);
    }
});
// Ensure upload directory exists
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
// POST /api/v1/images
export const uploadImage = async (req, res, next) => {
    try {
        req.fileFormatError = false;
        // Use multer to handle the file upload
        upload.single('image')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            if (!req.file) {
                if (req.fileFormatError) {
                    return res.status(400).json({ error: 'Only JPEG, PNG, HEIC/HEIF images are allowed' });
                }
                return res.status(400).json({ error: 'No image file provided' });
            }
            // Validate the file with Zod (if we have a validator)
            // We'll do additional validation with sharp
            let width = null;
            let height = null;
            let status = 'UPLOADED'; // We'll set to PROCESSING after we start processing
            let rejectionReasons = [];
            try {
                // Use sharp to get metadata
                const metadata = await sharp(req.file.buffer).metadata();
                width = metadata.width || null;
                height = metadata.height || null;
                // Check if the image is valid (sharp will throw if corrupt)
                // We can also check the format
                const format = metadata.format?.toLowerCase();
                if (!['jpeg', 'png', 'heif'].includes(format || '')) {
                    throw new Error('Unsupported image format');
                }
                // If we get here, the image is valid
                status = 'PROCESSING';
            }
            catch (sharpError) {
                console.error('Sharp error:', sharpError);
                status = 'REJECTED';
                rejectionReasons = ['Invalid or corrupted image file'];
            }
            // Generate a unique storage key
            const storageKey = `${randomUUID()}.${req.file.mimetype.split('/')[1]}`;
            // Better to use the original extension or a default based on the mimetype
            const ext = path.extname(req.file.originalname);
            const storageKeyWithExt = `${randomUUID()}${ext}`;
            // Save the file to disk
            const filePath = path.join(uploadDir, storageKeyWithExt);
            await fs.promises.writeFile(filePath, req.file.buffer);
            // Create the image record in the database
            const image = await prisma.image.create({
                data: {
                    originalFilename: req.file.originalname,
                    storageKey: storageKeyWithExt,
                    mimeType: req.file.mimetype,
                    sizeBytes: req.file.size,
                    width,
                    height,
                    status,
                    rejectionReasons: rejectionReasons.length > 0 ? rejectionReasons : null,
                }
            });
            // If the image was processed successfully, we can set status to UPLOADED (or PROCESSING if we want to do async processing)
            // For now, we'll set to UPLOADED if no errors, otherwise REJECTED.
            if (status === 'PROCESSING' && rejectionReasons.length === 0) {
                await prisma.image.update({
                    where: { id: image.id },
                    data: { status: 'UPLOADED' }
                });
            }
            res.status(201).json({
                id: image.id,
                status: image.status,
                originalFilename: image.originalname,
                mimeType: image.mimeType,
                sizeBytes: image.sizeBytes,
                width: image.width,
                height: image.height
            });
        });
    }
    catch (error) {
        next(error);
    }
};
// GET /api/v1/images
export const getImages = async (req, res, next) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100
        const skip = (page - 1) * limit;
        const [images, total] = await prisma.$transaction([
            prisma.image.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.image.count()
        ]);
        res.json({
            data: images,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        next(error);
    }
};
// GET /api/v1/images/:id
export const getImageById = async (req, res, next) => {
    try {
        const image = await prisma.image.findUnique({
            where: { id: req.params.id }
        });
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }
        res.json(image);
    }
    catch (error) {
        next(error);
    }
};
// DELETE /api/v1/images/:id
export const deleteImage = async (req, res, next) => {
    try {
        const image = await prisma.image.findUnique({
            where: { id: req.params.id }
        });
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }
        // Delete the file from disk
        const filePath = path.join(uploadDir, image.storageKey);
        try {
            await fs.promises.unlink(filePath);
        }
        catch (unlinkError) {
            const errorMessage = unlinkError instanceof Error ? unlinkError.message : String(unlinkError);
            console.warn(`Failed to delete file ${filePath}: ${errorMessage}`);
        }
        // Delete the database record
        await prisma.image.delete({
            where: { id: req.params.id }
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
};
