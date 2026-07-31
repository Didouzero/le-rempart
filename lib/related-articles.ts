import type { ArticleCategory } from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";

const STOPWORDS = new Set([
  "avec",
  "dans",
  "des",
  "les",
  "leur",
  "leurs",
  "mais",
  "nos",
  "notre",
  "nous",
  "par",
  "pas",
  "plus",
  "pour",
  "que",
  "qui",
  "ses",
  "son",
  "sur",
  "une",
  "vos",
  "votre",
  "vous",
  "apres",
  "avant",
  "entre",
  "sous",
  "vers",
  "chez",
  "comme",
  "tout",
  "tous",
  "toute",
  "toutes",
  "etre",
  "fait",
  "faire",
  "dit",
  "ans",
  "jour",
  "jours",
  "contre",
  "lors",
  "deja",
  "encore",
  "tres",
  "aussi",
  "dont",
  "elle",
  "elles",
  "rempart",
  "selon",
  "alors",
  "apres",
  "cette",
  "cet",
  "ces",
]);

export type RelatedArticle = {
  publicId: number;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
};

type Candidate = RelatedArticle & {
  publishedAt: Date | null;
};

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Tokens utiles du titre / chapô pour le rapprochement thématique. */
export function themeTokens(
  ...parts: Array<string | null | undefined>
): Set<string> {
  const blob = fold(parts.filter(Boolean).join(" "));
  const tokens = blob.match(/[a-z0-9]{4,}/g) || [];
  return new Set(tokens.filter((t) => !STOPWORDS.has(t)));
}

function overlapScore(
  source: Set<string>,
  title: string,
  excerpt: string,
): number {
  if (source.size === 0) return 0;
  const candidate = themeTokens(title, excerpt);
  let hits = 0;
  for (const token of source) {
    if (candidate.has(token)) hits += 1;
  }
  return hits;
}

function rankByTheme(source: Set<string>, rows: Candidate[]): Candidate[] {
  return [...rows].sort((a, b) => {
    const scoreA = overlapScore(source, a.title, a.excerpt);
    const scoreB = overlapScore(source, b.title, b.excerpt);
    if (scoreB !== scoreA) return scoreB - scoreA;
    const dateA = a.publishedAt?.getTime() ?? 0;
    const dateB = b.publishedAt?.getTime() ?? 0;
    return dateB - dateA;
  });
}

/**
 * 3 articles liés : même rubrique d'abord, puis score de thème (titre/chapô),
 * complétés si besoin hors rubrique avec le même score.
 */
export async function findRelatedArticles(input: {
  excludeId: string;
  category: ArticleCategory;
  title: string;
  excerpt: string;
  take?: number;
}): Promise<RelatedArticle[]> {
  const take = input.take ?? 3;
  const tokens = themeTokens(input.title, input.excerpt);

  const select = {
    publicId: true,
    title: true,
    excerpt: true,
    coverImageUrl: true,
    publishedAt: true,
  } as const;

  const sameCategory = await withDbTimeout(
    prisma.article.findMany({
      where: {
        status: "published",
        category: input.category,
        NOT: { id: input.excludeId },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 40,
      select,
    }),
  );

  const picked = rankByTheme(tokens, sameCategory).slice(0, take);
  if (picked.length >= take) {
    return picked.map(({ publicId, title, excerpt, coverImageUrl }) => ({
      publicId,
      title,
      excerpt,
      coverImageUrl,
    }));
  }

  const pickedIds = new Set(picked.map((p) => p.publicId));

  const others = await withDbTimeout(
    prisma.article.findMany({
      where: {
        status: "published",
        NOT: {
          OR: [{ id: input.excludeId }, { category: input.category }],
        },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 40,
      select,
    }),
  );

  for (const row of rankByTheme(tokens, others)) {
    if (picked.length >= take) break;
    if (pickedIds.has(row.publicId)) continue;
    picked.push(row);
    pickedIds.add(row.publicId);
  }

  return picked.map(({ publicId, title, excerpt, coverImageUrl }) => ({
    publicId,
    title,
    excerpt,
    coverImageUrl,
  }));
}
