import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../index";
import multer from "multer";
import sharp from "sharp";
import { ZodError } from "zod";
import { imageUploadSchema } from "../validators/imageValidator";

const upload = multer({ storage: multer.memoryStorage() });

export const uploadImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const { error } = imageUploadSchema.safeParse(req.file);
    if (error) {
      throw new Error(`Invalid file: ${error.message}`);
    }

    // Process image with sharp to get metadata
    const imageBuffer = req.file.buffer;
    const metadata = await sharp(imageBuffer).metadata();

    // Generate unique filename
    const filename = `${uuidv4()}.${metadata.format}`;

    // Save file to uploads directory
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    const filePath = `${uploadDir}/${filename}`;
    
    // In a real app, we would save the file here
    // For now, we'll just record the metadata in the database

    // Save image record to database
    const image = await prisma.image.create({
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
  } catch (error) {
    next(error);
  }
};

export const getImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100
    const skip = (page - 1) * limit;

    const [images, totalCount] = await prisma.$transaction([
      prisma.image.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.image.count(),
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
  } catch (error) {
    next(error);
  }
};

export const getImageById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imageId = req.params.id;

    const image = await prisma.image.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    res.json(image);
  } catch (error) {
    next(error);
  }
};

export const deleteImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imageId = req.params.id;

    // Find the image record
    const image = await prisma.image.findUnique({
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
    await prisma.image.delete({
      where: { id: imageId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
