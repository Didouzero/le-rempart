-- CreateEnum
CREATE TYPE "VeilleStatus" AS ENUM ('found', 'published', 'skipped', 'failed');

-- CreateTable
CREATE TABLE "VeilleItem" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "headlineKey" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceTitle" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "canvaTitle" TEXT,
    "highlightWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "VeilleStatus" NOT NULL DEFAULT 'found',
    "errorMessage" TEXT,
    "articleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VeilleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VeilleItem_headlineKey_key" ON "VeilleItem"("headlineKey");

-- CreateIndex
CREATE INDEX "VeilleItem_status_createdAt_idx" ON "VeilleItem"("status", "createdAt");
