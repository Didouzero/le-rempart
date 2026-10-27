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
const READ_ALSO = "**À lire aussi :**";

const COMMON_CAPS = new Set([
  "france", "francais", "francaise", "etat", "gouvernement", "paris", "europe",
  "president", "ministre", "premier", "assemblee", "nationale", "republique",
  // Présents dans trop de sujets pour signaler un lien réel.
  "macron", "emmanuel", "rassemblement", "insoumise",
]);

/** Noms propres (mots à majuscule hors début de phrase), repliés sans accents. */
function properNouns(text: string): Set<string> {
  const out = new Set<string>();
  for (const sentence of text.split(/[.!?:;«»"()]\s*/)) {
    const words = sentence.trim().split(/\s+/).slice(1);
    for (const w of words) {
      const clean = w.replace(/[^\p{L}'-]/gu, "");
      if (clean.length < 4 || !/^\p{Lu}/u.test(clean) || clean === clean.toUpperCase()) continue;
      const folded = clean.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!COMMON_CAPS.has(folded)) out.add(folded);
    }
  }
  return out;
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { sourcesSection, stripSourcesSection } = await import("../lib/article-links");
  const { themeTokens } = await import("../lib/related-articles");
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
  const tokens = new Map(articles.map((a) => [a.id, themeTokens(a.title, a.excerpt)]));
  const names = new Map(articles.map((a) => [a.id, properNouns(`${a.title}. ${a.excerpt}`)]));

  const changes: Array<{ id: string; publicId: number; before: string; after: string }> = [];
  let withSources = 0;
  let withLinks = 0;

  for (const a of articles) {
    if (a.content.includes(READ_ALSO)) continue; // déjà traité
    const mine = tokens.get(a.id)!;
    const myNames = names.get(a.id)!;
    // Articles plus anciens uniquement : un lien ne pointe jamais vers le futur.
    const related = articles
      .filter((b) => b.id !== a.id && (b.publishedAt?.getTime() ?? 0) < (a.publishedAt?.getTime() ?? 0))
      .map((b) => {
        let score = 0;
        for (const t of tokens.get(b.id)!) if (mine.has(t)) score += 1;
        let shared = 0;
        for (const n of names.get(b.id)!) if (myNames.has(n)) shared += 1;
        return { b, score: score + 2 * shared, shared };
      })
      .filter((x) => x.shared >= 1 && x.score >= 4)
      .sort((x, y) => y.score - x.score)
      .slice(0, 2)
      .map((x) => x.b);

    let body = stripSourcesSection(a.content);
    if (related.length) {
      const block = `${READ_ALSO} ${related
        .map((b) => `[${b.title.replace(/[[\]]/g, "")}](/articles/${b.publicId})`)
        .join(" · ")}`;
      // Après le deuxième paragraphe du corps (avant le premier intertitre s'il vient plus tôt).
      const paras = body.split(/\n{2,}/);
      let at = 0;
      let seen = 0;
      for (let i = 0; i < paras.length; i++) {
        if (paras[i]!.startsWith("#")) {
          if (seen > 0) break;
          continue;
        }
        seen += 1;
        at = i + 1;
        if (seen === 2) break;
      }
      paras.splice(at, 0, block);
      body = paras.join("\n\n");
      withLinks += 1;
    }
    const src =
      a.sourceUrl && /^https?:\/\//.test(a.sourceUrl) && !a.content.includes(a.sourceUrl)
        ? sourcesSection([{ url: a.sourceUrl }])
        : "";
    if (src) withSources += 1;
    const after = [body, src].filter(Boolean).join("\n\n");
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
