"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = require("express");
const cors_1 = require("cors");
const dotenv_1 = require("dotenv");
const client_1 = require("@prisma/client");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)({ origin: process.env.CLIENT_ORIGIN }));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Prisma client
exports.prisma = new client_1.PrismaClient();
// Health check endpoint
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});
// Import and use image routes
const images_1 = require("./routes/images");
app.use("/api/v1/images", images_1.imageRouter);
// Global error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
