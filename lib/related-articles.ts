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
  "avoir",
  "face",
  "info",
  "radio",
  // Dates : présentes partout, elles ne disent rien du sujet.
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
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
  return new Set(tokens.filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t)));
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

export type LinkableArticle = { publicId: number; title: string };

/**
 * Articles déjà publiés qui partagent au moins deux mots-clés avec un sujet :
 * candidats aux liens internes placés dans le corps d'un nouvel article.
 */
export async function findLinkableArticles(input: {
  text: string;
  excludePublicId?: number;
  take?: number;
}): Promise<LinkableArticle[]> {
  const tokens = themeTokens(input.text);
  if (tokens.size === 0) return [];
  const names = properNouns(input.text);
  const rows = await withDbTimeout(
    prisma.article.findMany({
      where: {
        status: "published",
        ...(input.excludePublicId
          ? { NOT: { publicId: input.excludePublicId } }
          : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 600,
      select: { publicId: true, title: true, excerpt: true, publishedAt: true },
    }),
  );
  return rows
    .map((row) => {
      // Même personne ou même institution : le signal le plus fiable d'un lien utile.
      const shared = [...properNouns(`${row.title}. ${row.excerpt}`)].filter((n) =>
        names.has(n),
      ).length;
      return { row, score: overlapScore(tokens, row.title, row.excerpt) + 2 * shared };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.take ?? 8)
    .map(({ row }) => ({ publicId: row.publicId, title: row.title }));
}

const COMMON_CAPS = new Set([
  "france", "francais", "francaise", "etat", "gouvernement", "paris", "europe",
  "president", "ministre", "premier", "assemblee", "nationale", "republique",
  // Présents dans trop de sujets pour signaler un lien réel.
  "macron", "emmanuel", "rassemblement", "insoumise",
  // Mots courants en majuscule dans un nom d'émission ou de média (« Face à l'info », « Radio Nova »).
  "face", "radio", "info", "journal", "police", "justice",
]);

/**
 * Noms propres (suites de mots à majuscule hors début de phrase), repliés sans accents.
 * Seul le dernier mot compte : « Philippe Juvin » et « Édouard Philippe » restent distincts.
 */
export function properNouns(text: string): Set<string> {
  const out = new Set<string>();
  const close = (name: string[]) => {
    const last = name.at(-1);
    if (!last) return;
    const folded = fold(last);
    // « Le Pen » : le dernier mot d'un nom composé peut être très court.
    const longEnough = last.length >= 4 || (name.length > 1 && last.length === 3);
    if (longEnough && !COMMON_CAPS.has(folded)) out.add(folded);
  };
  for (const sentence of text.split(/[.!?:;,«»"()]\s*/)) {
    const words = sentence.trim().split(/\s+/).slice(1);
    let name: string[] = [];
    for (const w of words) {
      const clean = w.replace(/[^\p{L}'-]/gu, "");
      const isName =
        clean.length >= 2 && /^\p{Lu}/u.test(clean) && clean !== clean.toUpperCase();
      if (isName) {
        name.push(clean);
      } else {
        close(name);
        name = [];
      }
    }
    close(name);
  }
  return out;
}

type ReadAlsoCandidate = { publicId: number; title: string; excerpt: string };

/**
 * Règle de l'encadré « À lire aussi » : au moins un nom propre en commun
 * et un score (mots-clés + 2 par nom propre partagé) d'au moins 4. Deux articles au plus.
 */
export function pickReadAlso(
  subject: { title: string; excerpt: string },
  candidates: ReadAlsoCandidate[],
  take = 2,
): ReadAlsoCandidate[] {
  const mine = themeTokens(subject.title, subject.excerpt);
  const myNames = properNouns(`${subject.title}. ${subject.excerpt}`);
  return candidates
    .filter((b) => b.title !== b.title.toUpperCase())
    .map((b) => {
      let score = 0;
      for (const t of themeTokens(b.title, b.excerpt)) if (mine.has(t)) score += 1;
      let shared = 0;
      for (const n of properNouns(`${b.title}. ${b.excerpt}`)) if (myNames.has(n)) shared += 1;
      return { b, score: score + 2 * shared, shared };
    })
    .filter((x) => x.shared >= 1 && x.score >= 4)
    .sort((x, y) => y.score - x.score)
    .slice(0, take)
    .map((x) => x.b);
}

/** Encadré « À lire aussi » d'un nouvel article, parmi les 600 derniers publiés. */
export async function findReadAlso(input: {
  title: string;
  excerpt: string;
  /** Articles déjà liés dans le texte : inutile de les répéter. */
  excludePublicIds?: number[];
  /** Nombre de candidats gardés. */
  take?: number;
}): Promise<ReadAlsoCandidate[]> {
  const rows = await withDbTimeout(
    prisma.article.findMany({
      where: {
        status: "published",
        ...(input.excludePublicIds?.length
          ? { NOT: { publicId: { in: input.excludePublicIds } } }
          : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 600,
      select: { publicId: true, title: true, excerpt: true },
    }),
  );
  return pickReadAlso(input, rows, input.take);
}
