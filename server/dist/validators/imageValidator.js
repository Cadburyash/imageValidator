"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageUploadSchema = void 0;
const zod_1 = require("zod");
// We can use Zod to validate the file if we were to accept it as a base64 string or something else.
// For multipart, we rely on multer and sharp.
// This validator is kept for consistency and potential future use.
exports.imageUploadSchema = zod_1.z.object({
// This schema is not directly used for multipart file validation, but we can validate other fields if needed.
// For example, if we had additional metadata in the request body.
// We'll leave it empty for now.
}).strict();
