import { prisma } from "@/lib/prisma";

/** Alias éditoriaux affichés à la place de « Rédaction ». */
export const AUTHOR_ALIASES = [
  "Clarence Azolina",
  "Rudy Levasseur",
  "Dimitri Scudo",
  "Roman Thill",
] as const;

export type AuthorAlias = (typeof AUTHOR_ALIASES)[number];

export function authorFromIndex(index: number): AuthorAlias {
  const i =
    ((index % AUTHOR_ALIASES.length) + AUTHOR_ALIASES.length) %
    AUTHOR_ALIASES.length;
  return AUTHOR_ALIASES[i]!;
}

/** Rotation stable pour un article déjà en base (backfill / fallback). */
export function authorFromPublicId(publicId: number): AuthorAlias {
  return authorFromIndex(Math.max(0, publicId - 1));
}

/** Prochain alias en round-robin (articles déjà pourvus d’un auteur). */
export async function allocateNextAuthorName(): Promise<AuthorAlias> {
  const count = await prisma.article.count({
    where: { authorName: { not: null } },
  });
  return authorFromIndex(count);
}
