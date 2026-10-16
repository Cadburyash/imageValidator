import { z } from "zod";

export const imageUploadSchema = z.object({
  buffer: z.instanceof(Buffer),
  originalname: z.string(),
  mimetype: z.union([
    z.literal("image/jpeg"),
    z.literal("image/png"),
    z.literal("image/heic"),
    z.literal("image/heif")
  ]),
  size: z.number().max(10 * 1024 * 1024, "File size must be less than 10MB"), // 10MB
});

export type ImageUploadSchema = z.infer<typeof imageUploadSchema>;
