import type { ArticleCategory, Prisma } from "@prisma/client";

export const ARTICLE_PAGE_SIZE = 10;

/** Découpe une requête en tokens (mots) utiles pour le filtre. */
export function parseSearchQuery(raw: string | undefined | null): string {
  return (raw || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function searchTokens(q: string): string[] {
  return q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);
}

/**
 * Filtre articles publiés : tous les mots doivent apparaître
 * dans titre OU chapô OU corps (insensible à la casse).
 */
export function publishedArticleWhere(input: {
  category?: ArticleCategory;
  q?: string | null;
}): Prisma.ArticleWhereInput {
  const where: Prisma.ArticleWhereInput = {
    status: "published",
  };
  if (input.category) {
    where.category = input.category;
  }

  const tokens = searchTokens(parseSearchQuery(input.q));
  if (tokens.length === 0) return where;

  where.AND = tokens.map((token) => ({
    OR: [
      { title: { contains: token, mode: "insensitive" } },
      { excerpt: { contains: token, mode: "insensitive" } },
      { content: { contains: token, mode: "insensitive" } },
    ],
  }));

  return where;
}

export function parsePageParam(raw: string | undefined): number {
  return Math.max(1, Number.parseInt(raw || "1", 10) || 1);
}
