import { Request, Response, NextFunction } from 'express';
import { Prisma, Status } from '@prisma/client';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import phash from 'sharp-phash';

function calculateHammingDistance(hash1: string, hash2: string): number {
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

async function calculateBlurScore(imageBuffer: Buffer): Promise<number> {
  const laplacian = await sharp(imageBuffer)
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

  const mean =
    laplacian.reduce((sum, value) => sum + value, 0) /
    laplacian.length;

  const variance =
    laplacian.reduce(
      (sum, value) => sum + Math.pow(value - mean, 2),
      0,
    ) / laplacian.length;

  return variance;
}

const maxFileSize =
  Number(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSize,
  },
  fileFilter: (_req, file, callback) => {

    console.log('Uploaded filename:', file.originalname);
    console.log('Uploaded MIME type:', file.mimetype);

    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/heic',
        'image/heif',
        'image/heic-sequence',
        'image/heif-sequence',
        'application/octet-stream',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      callback(new Error('Only JPEG, PNG, HEIC and HEIF images are allowed'));
      return;
    }

    callback(null, true);
  },
});

const uploadDir = path.resolve(
  process.env.UPLOAD_DIR || 'uploads'
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// POST /api/v1/images
export const uploadImage = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  upload.single('image')(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        const message =
          uploadError instanceof Error
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

        let faceValidation: {
        faceCount: number;
        facesTooSmall: boolean;
        rejectionReasons: string[];
      } | null = null;

      try {
        const rawFaceValidation = req.body?.faceValidation;

        if (typeof rawFaceValidation === 'string') {
          faceValidation = JSON.parse(rawFaceValidation);
        }
      } catch {
        return res.status(400).json({
          error: 'Invalid face validation data',
        });
      }

      console.log('Backend received face validation:', faceValidation);

      let perceptualHash: string | null = null;
      let width: number | null = null;
      let height: number | null = null;
      let status: Status = Status.UPLOADED;
      let rejectionReasons: string[] = [];

      try {
        const metadata = await sharp(file.buffer).metadata();
        perceptualHash = await phash(file.buffer);

        const blurScore = await calculateBlurScore(file.buffer);

        console.log('Image blur score:', blurScore);

        const BLUR_THRESHOLD = 50;

        if (blurScore < BLUR_THRESHOLD) {
          status = Status.REJECTED;

          rejectionReasons.push(
            `Image appears blurry (score: ${blurScore.toFixed(2)})`
          );
        }

        const existingImages = await prisma.image.findMany({
          where: {
            perceptualHash: {
              not: null,
            },
            status: {
              in: [Status.UPLOADED, Status.ACCEPTED],
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

          const distance = calculateHammingDistance(
            perceptualHash,
            existingImage.perceptualHash
          );

          if (distance <= SIMILARITY_THRESHOLD) {
            status = Status.REJECTED;

            rejectionReasons.push(
              `Image is too similar to an existing image: ${existingImage.originalFilename}`
            );

            break;
          }
        }

        width = metadata.width ?? null;
        height = metadata.height ?? null;

        const format = metadata.format?.toLowerCase();

        const supportedFormats = ['jpeg', 'png', 'heif'];

        if (!format || !supportedFormats.includes(format)) {
          status = Status.REJECTED;
          rejectionReasons.push(
            `Unsupported image format: ${format || 'unknown'}`
          );
        }

        // Basic resolution validation.
        if (!width || !height || width < 100 || height < 100) {
          status = Status.REJECTED;
          rejectionReasons.push(
            'Image resolution is too small'
          );
        }
      } catch (error) {
        status = Status.REJECTED;

        rejectionReasons.push(
          'Invalid, corrupted, or unsupported image file'
        );

        console.error('Image validation failed:', error);
      }

      if (faceValidation) {
        if (faceValidation.faceCount > 1) {
          status = Status.REJECTED;

          rejectionReasons.push('Multiple faces detected');
        }

        if (faceValidation.facesTooSmall) {
          status = Status.REJECTED;

          rejectionReasons.push('Detected face is too small');
        }
      }

      // Mark the image as accepted if all validations pass.
      if (status !== Status.REJECTED) {
        status = Status.ACCEPTED;
      }

      console.log('Final status after face validation:', status);
      console.log('Final rejection reasons:', rejectionReasons);

      const extension = path.extname(file.originalname);
      const storageKey = `${randomUUID()}${extension}`;

      const filePath = path.join(uploadDir, storageKey);

      await fs.promises.writeFile(filePath, file.buffer);

      // Finalize the validation status before saving.
      if (status !== Status.REJECTED) {
        status = Status.ACCEPTED;
      }

      console.log('Status being saved to database:', status);

      let image;

      try {
        image = await prisma.image.create({
          data: {
            originalFilename: file.originalname,
            storageKey,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            width,
            height,
            perceptualHash,
            status,
            rejectionReasons:
              rejectionReasons.length > 0
                ? rejectionReasons
                : Prisma.JsonNull,
          },
        });
      } catch (databaseError) {
        // Avoid leaving an uploaded file behind if saving the
        // database record fails.
        await fs.promises.unlink(filePath).catch(() => {});
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
    } catch (error) {
      next(error);
    }
  });
};

// GET /api/v1/images
export const getImages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(
      Number.parseInt(req.query.page as string, 10) || 1,
      1
    );

    const limit = Math.min(
      Number.parseInt(req.query.limit as string, 10) || 20,
      100
    );

    const skip = (page - 1) * limit;

    const [images, total] = await prisma.$transaction([
      prisma.image.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.image.count(),
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
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/images/:id
export const getImageById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const image = await prisma.image.findUnique({
      where: { id: req.params.id },
    });

    if (!image) {
      return res.status(404).json({
        error: 'Image not found',
      });
    }

    return res.json(image);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/images/:id
export const deleteImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const image = await prisma.image.findUnique({
      where: { id: req.params.id },
    });

    if (!image) {
      return res.status(404).json({
        error: 'Image not found',
      });
    }

    const filePath = path.join(uploadDir, image.storageKey);

    await prisma.image.delete({
      where: { id: req.params.id },
    });

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      console.warn('Could not delete image file:', error);
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};