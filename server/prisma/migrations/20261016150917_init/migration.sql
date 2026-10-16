-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" "Status" NOT NULL,
    "rejectionReasons" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Image_status_idx" ON "Image"("status");

-- CreateIndex
CREATE INDEX "Image_createdAt_idx" ON "Image"("createdAt");
