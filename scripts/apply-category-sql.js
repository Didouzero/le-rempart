require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const p = new PrismaClient();

async function main() {
  await p.$queryRaw`SELECT 1 as ok`;
  console.log("db ok");

  await p.$executeRawUnsafe(`
DO $$ BEGIN
  CREATE TYPE "ArticleCategory" AS ENUM ('immigration', 'justice', 'economie', 'patrimoine', 'insolite');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
`);
  console.log("enum ok");

  await p.$executeRawUnsafe(`
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "category" "ArticleCategory" NOT NULL DEFAULT 'insolite';
`);
  console.log("column ok");

  await p.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "Article_status_category_publishedAt_idx"
ON "Article"("status", "category", "publishedAt");
`);
  console.log("index ok");

  // Mark migrations applied so future migrate deploy works
  await p.$executeRawUnsafe(`
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', NOW(), '20260726183000_add_veille_item', NULL, NULL, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260726183000_add_veille_item'
);
`);
  await p.$executeRawUnsafe(`
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', NOW(), '20260730140000_article_category', NULL, NULL, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260730140000_article_category'
);
`);
  console.log("migrations table updated");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
