/**
 * Enregistre des sujets choisis à la main (par Claude en séance), sans appel d'IA.
 *   npx tsx scripts/import-tags.ts fichier1.txt [fichier2.txt…] [--dry]
 * Une ligne par article : « 530: Emmanuel Grégoire (personne), Paris (lieu), OQTF (sujet) ».
 * Les sujets de chaque article listé remplacent les précédents.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { parseTagLine } from "@/lib/tag-parse";
import { slugify } from "@/lib/slug";

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const lines = args
    .filter((a) => !a.startsWith("--"))
    .flatMap((f) => readFileSync(f, "utf8").split("\n"))
    .map((l) => l.match(/^\s*(\d+)\s*:\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m));

  const articles = await prisma.article.findMany({
    where: { publicId: { in: lines.map((m) => Number(m[1])) } },
    select: { id: true, publicId: true },
  });
  const byPublicId = new Map(articles.map((a) => [a.publicId, a.id]));

  // Import groupé : quelques requêtes en tout, au lieu de plusieurs par article.
  const rows: Array<{ articleId: string; tags: ReturnType<typeof parseTagLine> }> = [];
  for (const m of lines) {
    const publicId = Number(m[1]);
    const tags = parseTagLine(m[2]);
    const articleId = byPublicId.get(publicId);
    if (!articleId) console.warn(`#${publicId} introuvable`);
    else if (tags.length === 0) console.warn(`#${publicId} aucun sujet lisible : ${m[2]}`);
    else rows.push({ articleId, tags });
  }
  const saved = rows.length;

  if (!dry && rows.length) {
    // Le premier nom rencontré pour un sujet reste son nom d'affichage.
    const bySlug = new Map<string, { slug: string; name: string; kind: (typeof rows)[0]["tags"][0]["kind"] }>();
    for (const r of rows) for (const t of r.tags) {
      const slug = slugify(t.name);
      if (!bySlug.has(slug)) bySlug.set(slug, { slug, name: t.name, kind: t.kind });
    }
    await prisma.tag.createMany({ data: [...bySlug.values()], skipDuplicates: true });
    const tags = await prisma.tag.findMany({
      where: { slug: { in: [...bySlug.keys()] } },
      select: { id: true, slug: true },
    });
    const idBySlug = new Map(tags.map((t) => [t.slug, t.id]));
    const links = rows.flatMap((r) =>
      r.tags.map((t) => ({ articleId: r.articleId, tagId: idBySlug.get(slugify(t.name))! })),
    );
    await prisma.$transaction([
      prisma.articleTag.deleteMany({ where: { articleId: { in: rows.map((r) => r.articleId) } } }),
      prisma.articleTag.createMany({ data: links, skipDuplicates: true }),
    ]);
    console.log(`${bySlug.size} sujet(s), ${links.length} lien(s)`);
  }
  console.log(`${saved} article(s) ${dry ? "vérifiés" : "étiquetés"} sur ${lines.length} ligne(s)`);
  await prisma.$disconnect();
}

main();
