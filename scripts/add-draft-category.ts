/**
 * Ajoute la colonne « category » (rubrique choisie dans le bot) aux brouillons.
 * À lancer AVANT de déployer le code qui la lit.
 *
 *   npx tsx scripts/add-draft-category.ts
 */
import { readFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  // Colonne vide ajoutée : aucune donnée existante n'est modifiée.
  await prisma.$executeRawUnsafe(`ALTER TABLE "PublishDraft" ADD COLUMN IF NOT EXISTS "category" TEXT`);
  console.log("Colonne rubrique ajoutée aux brouillons.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
