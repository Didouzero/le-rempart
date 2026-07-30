-- CreateEnum
CREATE TYPE "ArticleCategory" AS ENUM ('immigration', 'justice', 'economie', 'patrimoine', 'insolite');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN "category" "ArticleCategory" NOT NULL DEFAULT 'insolite';

-- CreateIndex
CREATE INDEX "Article_status_category_publishedAt_idx" ON "Article"("status", "category", "publishedAt");
