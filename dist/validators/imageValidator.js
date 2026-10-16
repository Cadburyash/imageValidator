"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageUploadSchema = void 0;
const zod_1 = require("zod");
exports.imageUploadSchema = zod_1.z.object({
    buffer: zod_1.z.instanceof(Buffer),
    originalname: zod_1.z.string(),
    mimetype: zod_1.z.union([
        zod_1.z.literal("image/jpeg"),
        zod_1.z.literal("image/png"),
        zod_1.z.literal("image/heic"),
        zod_1.z.literal("image/heif")
    ]),
    size: zod_1.z.number().max(10 * 1024 * 1024, "File size must be less than 10MB"), // 10MB
});
