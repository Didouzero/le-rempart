/**
 * Rattrapage des articles existants : section « Sources » (lien vers la source
 * d'origine) et encadré « À lire aussi » (liens internes) dans le corps.
 *
 *   npx tsx scripts/backfill-article-links.ts            # essai à blanc
 *   npx tsx scripts/backfill-article-links.ts --apply    # écrit en base (sauvegarde avant)
 */
import { readFileSync, writeFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

const APPLY = process.argv.includes("--apply");
async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { READ_ALSO, insertReadAlso, sourcesSection, stripSourcesSection } = await import("../lib/article-links");
  const { pickReadAlso } = await import("../lib/related-articles");
  const prisma = new PrismaClient();

  const articles = await prisma.article.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "asc" },
    select: {
      id: true,
      publicId: true,
      title: true,
      excerpt: true,
      content: true,
      sourceUrl: true,
      publishedAt: true,
    },
  });
  const changes: Array<{ id: string; publicId: number; before: string; after: string }> = [];
  let withSources = 0;
  let withLinks = 0;

  for (const a of articles) {
    if (a.content.includes(READ_ALSO)) continue; // déjà traité
    // Articles plus anciens uniquement : un lien ne pointe jamais vers le futur.
    const older = articles.filter(
      (b) => b.id !== a.id && (b.publishedAt?.getTime() ?? 0) < (a.publishedAt?.getTime() ?? 0),
    );
    const related = pickReadAlso(a, older);
    const src =
      a.sourceUrl && /^https?:\/\//.test(a.sourceUrl) && !a.content.includes(a.sourceUrl)
        ? sourcesSection([{ url: a.sourceUrl }])
        : "";
    // Rien à ajouter : l'article reste intact (sa section Sources éventuelle comprise).
    if (!related.length && !src) continue;
    if (related.length) withLinks += 1;
    if (src) withSources += 1;
    const base = src ? stripSourcesSection(a.content) : a.content;
    const after = [insertReadAlso(base, related), src].filter(Boolean).join("\n\n");
    if (after !== a.content) {
      changes.push({ id: a.id, publicId: a.publicId, before: a.content, after });
    }
  }

  console.log(
    `${articles.length} articles · ${changes.length} à modifier · ${withLinks} avec « À lire aussi » · ${withSources} avec section Sources`,
  );
  for (const c of changes.filter((_, i) => i % 40 === 7)) {
    const added = c.after
      .split("\n")
      .filter((l) => l.startsWith(READ_ALSO) || l.startsWith("## Sources") || l.startsWith("- "));
    console.log(`\n#${c.publicId} ${articles.find((x) => x.id === c.id)!.title}\n${added.filter((l) => l.startsWith(READ_ALSO)).join("\n")}`);
  }

  if (APPLY) {
    const backup = `tmp/backup-article-content-${Date.now()}.json`;
    writeFileSync(backup, JSON.stringify(changes.map(({ id, before }) => ({ id, content: before }))));
    console.log(`\nSauvegarde : ${backup}`);
    for (const c of changes) {
      // updatedAt inchangé : ajouter des liens n'est pas une mise à jour éditoriale.
      await prisma.$executeRaw`UPDATE "Article" SET content = ${c.after} WHERE id = ${c.id}`;
    }
    console.log(`${changes.length} articles mis à jour.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
