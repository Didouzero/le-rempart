import { waitUntil } from "@vercel/functions";
import type { TagKind } from "@prisma/client";
import { claudeText, isClaudeConfigured } from "@/lib/claude-fallback";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import {
  MAX_TAGS_PER_ARTICLE,
  normalizeTags,
  type ProposedTag,
} from "@/lib/tag-parse";

export { TAG_KINDS, parseTagLine, type ProposedTag } from "@/lib/tag-parse";

/**
 * Sujets des articles : personnalités publiques, institutions, lieux et thèmes récurrents.
 * Chaque sujet a sa page /sujets/[slug], qui regroupe tous les articles qui en parlent.
 * Tout passe par Claude : le rédacteur (Claude sur le VPS) donne les sujets dans la ligne
 * « SUJETS : » du texte prêt ; à défaut, Claude les propose par l'API à la publication.
 * Le vocabulaire déjà en base est réutilisé pour qu'une même personne ait une seule page.
 */


/** Une page de sujet n'entre dans Google qu'à partir de ce nombre d'articles. */
export const TAG_INDEX_MIN_ARTICLES = 3;
/** Un sujet n'apparaît en lien sous un article qu'à partir de ce nombre d'articles. */
export const TAG_LINK_MIN_ARTICLES = 2;

/** Vocabulaire envoyé à Claude : les sujets les plus utilisés. */
const VOCABULARY_SIZE = 500;

export function tagPath(slug: string): string {
  return `/sujets/${slug}`;
}

const SYSTEM = `Tu indexes les articles d'un média d'actualité français. Pour l'article fourni, donne 2 à ${MAX_TAGS_PER_ARTICLE} sujets qui serviront de pages thématiques regroupant tous les articles sur ce sujet.

Types :
- personne : une personnalité publique (élu, ministre, candidat, chef d'entreprise, journaliste, militant connu, artiste, sportif). Prénom et nom complets, sans titre ni fonction : « Emmanuel Grégoire », pas « le maire de Paris ».
- organisation : institution, parti, administration, entreprise, média, association, juridiction. Nom usuel : « Cour des comptes », « La France insoumise », « France Inter », « Ofii ».
- lieu : ville, département ou pays, seulement quand l'article se passe vraiment là et que le lieu compte dans l'histoire.
- sujet : thème précis et récurrent, en minuscules sauf sigle : « OQTF », « hébergement d'urgence », « refus d'obtempérer », « audiovisuel public », « dette publique ».

Règles :
- Ne retiens que ce dont l'article parle vraiment, pas une mention en passant. Commence par le sujet principal.
- Si une entrée du vocabulaire existant désigne la même chose, recopie son nom exactement, à la lettre près.
- Jamais de personne privée (prévenu, victime, témoin, anonyme, prénom seul ou initiale de nom), jamais de mineur.
- Jamais de sujet trop large : pas « immigration », « justice », « économie », « politique », « insolite », « France », « société », « médias », « faits divers ».
- Réponds uniquement en JSON : {"tags":[{"name":"…","kind":"personne|organisation|lieu|sujet"}]}`;

function parseTags(raw: string): ProposedTag[] {
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const list = (data as { tags?: unknown })?.tags;
  return Array.isArray(list) ? normalizeTags(list) : [];
}

async function vocabulary(): Promise<string[]> {
  const tags = await prisma.tag.findMany({
    orderBy: { articles: { _count: "desc" } },
    take: VOCABULARY_SIZE,
    select: { name: true, kind: true },
  });
  return tags.map((t) => `${t.name} (${t.kind})`);
}

/** Enregistre les sujets d'un article (remplace les précédents si replace). */
export async function setArticleTags(
  articleId: string,
  tags: ProposedTag[],
  options: { replace?: boolean } = {},
): Promise<string[]> {
  if (tags.length === 0 && !options.replace) return [];
  const tagIds: string[] = [];
  for (const t of tags.slice(0, MAX_TAGS_PER_ARTICLE)) {
    const slug = slugify(t.name);
    // Le premier nom retenu pour un sujet reste son nom d'affichage.
    // Deux publications simultanées peuvent créer le même sujet : on relit alors l'existant.
    const tag = await prisma.tag
      .upsert({
        where: { slug },
        create: { slug, name: t.name, kind: t.kind },
        update: {},
        select: { id: true },
      })
      .catch(async (err) => {
        const existing = await prisma.tag.findUnique({ where: { slug }, select: { id: true } });
        if (!existing) throw err;
        return existing;
      });
    tagIds.push(tag.id);
  }
  await prisma.$transaction([
    ...(options.replace ? [prisma.articleTag.deleteMany({ where: { articleId } })] : []),
    prisma.articleTag.createMany({
      data: tagIds.map((tagId) => ({ articleId, tagId })),
      skipDuplicates: true,
    }),
  ]);
  return tags.map((t) => t.name);
}

/** Demande les sujets d'un article à Claude (API) et les enregistre. */
export async function tagArticle(
  articleId: string,
  options: { force?: boolean } = {},
): Promise<string[]> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      excerpt: true,
      content: true,
      status: true,
      _count: { select: { tags: true } },
    },
  });
  if (!article || article.status !== "published") return [];
  if (article._count.tags > 0 && !options.force) return [];

  const vocab = await vocabulary();
  const user = [
    vocab.length ? `Vocabulaire existant :\n${vocab.join("\n")}` : "Vocabulaire existant : (vide)",
    "",
    `Titre : ${article.title}`,
    `Chapô : ${article.excerpt}`,
    `Texte : ${article.content.slice(0, 3500)}`,
  ].join("\n");

  const raw = await claudeText({
    maxTokens: 400,
    timeoutMs: 60_000,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  });
  return setArticleTags(article.id, parseTags(raw), { replace: options.force });
}

/** Étiquette un article publié sans bloquer la réponse (après publication). */
export function scheduleArticleTagging(publicId: number): void {
  if (!isClaudeConfigured()) return;
  const job = (async () => {
    const article = await prisma.article.findUnique({
      where: { publicId },
      select: { id: true, status: true, _count: { select: { tags: true } } },
    });
    if (!article || article.status !== "published" || article._count.tags > 0) return;
    const names = await tagArticle(article.id);
    if (names.length) {
      const { revalidatePath } = await import("next/cache");
      revalidatePath(`/articles/${publicId}`);
    }
  })().catch((err) => console.warn("tagging", publicId, err));
  try {
    waitUntil(job);
  } catch {
    // Hors requête Vercel (script) : la promesse vit sa vie.
  }
}

export type TagWithCount = {
  slug: string;
  name: string;
  kind: TagKind;
  count: number;
};

/** Sujets d'un article qui méritent un lien (assez d'articles derrière). */
export async function articleTags(articleId: string): Promise<TagWithCount[]> {
  const rows = await withDbTimeout(
    prisma.articleTag.findMany({
      where: { articleId },
      select: {
        tag: {
          select: {
            slug: true,
            name: true,
            kind: true,
            _count: {
              select: { articles: { where: { article: { status: "published" } } } },
            },
          },
        },
      },
    }),
  );
  return rows
    .map((r) => ({
      slug: r.tag.slug,
      name: r.tag.name,
      kind: r.tag.kind,
      count: r.tag._count.articles,
    }))
    .filter((t) => t.count >= TAG_LINK_MIN_ARTICLES);
}

/** Sujets assez fournis pour être indexés, du plus suivi au moins suivi. */
export async function indexableTags(limit = 1000): Promise<TagWithCount[]> {
  const tags = await withDbTimeout(
    prisma.tag.findMany({
      select: {
        slug: true,
        name: true,
        kind: true,
        _count: {
          select: { articles: { where: { article: { status: "published" } } } },
        },
      },
      orderBy: { articles: { _count: "desc" } },
      take: limit * 2,
    }),
  );
  return tags
    .map((t) => ({ slug: t.slug, name: t.name, kind: t.kind, count: t._count.articles }))
    .filter((t) => t.count >= TAG_INDEX_MIN_ARTICLES)
    .slice(0, limit);
}

/** Sujets indexables pour le sitemap, avec la date de leur dernier article. */
export async function prismaTagSitemapRows(): Promise<
  Array<{ slug: string; lastPublishedAt: Date | null }>
> {
  const rows = await prisma.$queryRaw<Array<{ slug: string; last: Date | null; n: bigint }>>`
    SELECT t."slug", MAX(a."publishedAt") AS last, COUNT(*) AS n
    FROM "Tag" t
    JOIN "ArticleTag" at ON at."tagId" = t."id"
    JOIN "Article" a ON a."id" = at."articleId" AND a."status" = 'published'
    GROUP BY t."slug"
    HAVING COUNT(*) >= ${TAG_INDEX_MIN_ARTICLES}
    ORDER BY last DESC
  `;
  return rows.map((r) => ({ slug: r.slug, lastPublishedAt: r.last }));
}
