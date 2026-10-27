/**
 * Signature unique du site : le nom de plume du fondateur, qui assume
 * la direction éditoriale. C'est aussi l'auteur déclaré à Google (schema Person).
 */
export const SITE_AUTHOR = {
  name: "Dimitri Scudo",
  slug: "dimitri-scudo",
  path: "/auteurs/dimitri-scudo",
  jobTitle: "Fondateur et rédacteur en chef",
  /** Portrait affiché sur la page auteur (fichier dans public/), ou null tant qu'il n'est pas fourni. */
  photo: "/dimitri-scudo-portrait.jpg" as string | null,
  /** Courte bio (schema Person `description`). */
  bio: "Fondateur et rédacteur en chef du Rempart, média d'actualité indépendant ancré à droite. Il choisit les sujets, fixe la ligne éditoriale et répond de tout ce qui est publié.",
} as const;

/** Auteur affiché d'un article (les anciens alias en base sont remplacés). */
export function articleAuthorName(stored?: string | null): string {
  return stored?.trim() || SITE_AUTHOR.name;
}

/** Auteur attribué à un nouvel article. */
export async function allocateNextAuthorName(): Promise<string> {
  return SITE_AUTHOR.name;
}
