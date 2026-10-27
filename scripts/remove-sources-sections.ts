/**
 * Retire des articles la section « Sources » de fin d'article et transforme
 * en texte simple les liens vers les réseaux sociaux.
 *
 *   npx tsx scripts/remove-sources-sections.ts           # essai à blanc
 *   npx tsx scripts/remove-sources-sections.ts --apply   # écrit en base (sauvegarde avant)
 */
import { readFileSync, writeFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

const MD_LINK = /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { isSocialUrl, stripSourcesSection } = await import("../lib/article-links");
  const prisma = new PrismaClient();
  const rows = await prisma.article.findMany({ select: { id: true, publicId: true, content: true } });

  const changes: Array<{ id: string; publicId: number; before: string; after: string }> = [];
  let sections = 0;
  let social = 0;
  for (const r of rows) {
    let after = stripSourcesSection(r.content);
    if (after !== r.content.trimEnd()) sections += 1;
    after = after.replace(MD_LINK, (full, text: string, href: string) => {
      if (!isSocialUrl(href)) return full;
      social += 1;
      return text;
    });
    if (after !== r.content) changes.push({ id: r.id, publicId: r.publicId, before: r.content, after });
  }
  console.log(`${rows.length} articles · ${changes.length} à modifier · ${sections} sections Sources · ${social} liens vers des réseaux sociaux`);

  if (process.argv.includes("--apply")) {
    const backup = `tmp/backup-sources-${Date.now()}.json`;
    writeFileSync(backup, JSON.stringify(changes.map(({ id, before }) => ({ id, content: before }))));
    for (const c of changes) {
      // updatedAt inchangé : c'est une mise en forme, pas une mise à jour éditoriale.
      await prisma.$executeRaw`UPDATE "Article" SET content = ${c.after} WHERE id = ${c.id}`;
    }
    console.log(`Sauvegarde : ${backup}\n${changes.length} articles mis à jour.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
