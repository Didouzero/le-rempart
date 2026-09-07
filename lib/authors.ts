import { prisma } from "@/lib/prisma";
import {
  AUTHOR_ALIASES,
  authorFromIndex,
  authorFromPublicId,
  type AuthorAlias,
} from "@/lib/authors";

export {
  AUTHOR_ALIASES,
  authorFromIndex,
  authorFromPublicId,
  type AuthorAlias,
};

/** Prochain alias en round-robin (articles déjà pourvus d’un auteur). */
export async function allocateNextAuthorName(): Promise<AuthorAlias> {
  const count = await prisma.article.count({
    where: { authorName: { not: null } },
  });
  return authorFromIndex(count);
}
