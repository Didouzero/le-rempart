/**
 * Ajoute la colonne « coverCaption » (légende d'illustration) en base, puis
 * déplace sous la photo les crédits Wikipédia ajoutés en bas des articles.
 * À lancer AVANT de déployer le code qui lit ce champ.
 *
 *   npx tsx scripts/add-cover-caption.ts
 */
import { readFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  // Colonnes vides ajoutées : aucune donnée existante n'est modifiée.
  await prisma.$executeRawUnsafe(`ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "coverCaption" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "PublishDraft" ADD COLUMN IF NOT EXISTS "coverCaption" TEXT`);
  console.log("Colonne légende ajoutée.");

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; publicId: number; content: string }>>(
    `SELECT id, "publicId", content FROM "Article" WHERE content LIKE '%*Illustration :%'`,
  );
  for (const r of rows) {
    const m = r.content.match(/\n*\*Illustration : (.+?)\.\*\s*$/);
    if (!m) continue;
    const caption = `Photo : ${m[1]}`;
    const content = r.content.slice(0, m.index).trimEnd();
    await prisma.$executeRaw`UPDATE "Article" SET "coverCaption" = ${caption}, content = ${content} WHERE id = ${r.id}`;
    console.log(`#${r.publicId} → ${caption}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
