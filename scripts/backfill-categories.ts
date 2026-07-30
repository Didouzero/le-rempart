/**
 * Recalcule la rubrique de tous les articles existants.
 * Usage: npx tsx scripts/backfill-categories.ts
 */
import { config } from "dotenv";
config();

import { classifyArticleCategory } from "../lib/categories";
import { prisma } from "../lib/prisma";

async function main() {
  const articles = await prisma.article.findMany({
    select: {
      id: true,
      publicId: true,
      title: true,
      excerpt: true,
      content: true,
      category: true,
    },
  });

  let updated = 0;
  for (const a of articles) {
    const next = classifyArticleCategory({
      title: a.title,
      excerpt: a.excerpt,
      content: a.content,
    });
    if (next === a.category) continue;
    await prisma.article.update({
      where: { id: a.id },
      data: { category: next },
    });
    updated += 1;
    console.log(`#${a.publicId} → ${next} | ${a.title.slice(0, 70)}`);
  }
  console.log(`Done. ${updated}/${articles.length} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
