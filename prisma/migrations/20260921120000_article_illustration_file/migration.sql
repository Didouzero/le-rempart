-- Illustration site : fichier Telegram (distinct de la créative Facebook).
ALTER TABLE "Article" ADD COLUMN "illustrationMime" TEXT;
ALTER TABLE "Article" ADD COLUMN "illustrationData" BYTEA;

ALTER TABLE "PublishDraft" ADD COLUMN "coverImageMime" TEXT;
ALTER TABLE "PublishDraft" ADD COLUMN "coverImageData" BYTEA;
