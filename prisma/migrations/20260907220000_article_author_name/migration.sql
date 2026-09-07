-- AlterTable
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "authorName" TEXT;

-- Backfill : rotation stable sur publicId
UPDATE "Article"
SET "authorName" = (ARRAY[
  'Clarence Azolina',
  'Rudy Levasseur',
  'Dimitri Scudo',
  'Roman Thill'
])[((("publicId" - 1) % 4) + 1)]
WHERE "authorName" IS NULL;
