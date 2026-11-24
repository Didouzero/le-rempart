/**
 * « Mis à jour le… » affiché à tort : la purge des créatives (24 h après publication) et une
 * opération groupée du 27/10/2026 ont touché `updatedAt` sans rien changer au texte.
 * Remet la date de mise à jour à la date de publication, sauf pour les articles dont le
 * titre a vraiment été réécrit (scripts/retitle-low-ctr*.ts).
 *
 *   npx tsx scripts/fix-false-updates-2026-11.ts           # aperçu
 *   npx tsx scripts/fix-false-updates-2026-11.ts --apply   # écrit en base (sauvegarde avant)
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

/** Titres réellement réécrits : leur mise à jour est vraie. */
const REAL_EDITS = [382, 70, 223, 329, 332, 208, 64, 380, 411, 431, 506, 463];

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const rows = await prisma.$queryRaw<Array<{ publicId: number; publishedAt: Date; updatedAt: Date }>>`
    SELECT "publicId", "publishedAt", "updatedAt" FROM "Article"
    WHERE status = 'published' AND "publishedAt" IS NOT NULL
      AND "updatedAt" - "publishedAt" > interval '1 hour'`;
  const targets = rows.filter((r) => !REAL_EDITS.includes(r.publicId));
  console.log(`${rows.length} articles affichent « Mis à jour », ${targets.length} à tort.`);
  if (process.argv.includes("--apply")) {
    mkdirSync("tmp", { recursive: true });
    const backup = `tmp/backup-updatedAt-${Date.now()}.json`;
    writeFileSync(backup, JSON.stringify(targets, null, 2));
    const ids = targets.map((t) => t.publicId);
    const n = await prisma.$executeRaw`
      UPDATE "Article" SET "updatedAt" = "publishedAt"
      WHERE "publicId" = ANY(${ids}) AND "publishedAt" IS NOT NULL`;
    console.log(`Sauvegarde : ${backup}\n${n} articles corrigés.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
