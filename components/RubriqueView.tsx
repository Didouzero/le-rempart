import type { Metadata } from "next";
import { ArticleCard } from "@/components/ArticleCard";
import { ListPageHeader } from "@/components/ArticleSearch";
import { JsonLd } from "@/components/JsonLd";
import { Pagination } from "@/components/Pagination";
import {
  ARTICLE_PAGE_SIZE,
  publishedArticleWhere,
} from "@/lib/article-list";
import { CATEGORY_META, type ArticleCategory } from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";
import {
  absoluteUrl,
  buildPageMetadata,
  collectionPageJsonLd,
} from "@/lib/seo";

const CATEGORY_OG_IMAGE: Partial<Record<ArticleCategory, string>> = {
  immigration: "/rubriques/immigration.webp",
};

/**
 * Métadonnées d'une rubrique. La première page est servie en cache par
 * /rubriques/[slug] ; pagination et recherche passent par /rubriques-liste/[slug]
 * (réécriture du middleware), l'adresse visible restant /rubriques/[slug]?….
 */
export function rubriqueMetadata(
  category: ArticleCategory,
  page: number,
  q: string,
): Metadata {
  const meta = CATEGORY_META[category];
  const pathBase = `/rubriques/${meta.slug}`;
  const image = CATEGORY_OG_IMAGE[category]
    ? absoluteUrl(CATEGORY_OG_IMAGE[category]!)
    : undefined;

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (page > 1) qs.set("page", String(page));
  const path = qs.toString() ? `${pathBase}?${qs}` : pathBase;

  const titleParts = [
    page === 1 && !q ? meta.seoTitle : meta.label,
    q ? `« ${q} »` : null,
    page > 1 ? `page ${page}` : null,
  ].filter(Boolean);

  return buildPageMetadata({
    title: titleParts.join(" — "),
    description: q
      ? `Recherche « ${q} » dans la rubrique ${meta.label} — Le Rempart.`
      : page > 1
        ? `${meta.description} Page ${page}.`
        : meta.description,
    path,
    image,
    imageAlt: `Rubrique ${meta.label} — Le Rempart`,
    feedCategory: category,
    // Les résultats de recherche ne doivent pas entrer dans l'index Google.
    noIndex: Boolean(q),
  });
}

export async function RubriqueView({
  category,
  requested,
  q,
}: {
  category: ArticleCategory;
  requested: number;
  q: string;
}) {
  const meta = CATEGORY_META[category];
  const path = `/rubriques/${meta.slug}`;
  const where = publishedArticleWhere({ category, q });

  let total = 0;
  let articles: Array<{
    id: string;
    publicId: number;
    title: string;
    excerpt: string;
    publishedAt: Date | null;
    coverImageUrl: string | null;
    category: ArticleCategory;
  }> = [];

  try {
    total = await withDbTimeout(prisma.article.count({ where }));
  } catch {
    total = 0;
  }

  const totalPages = Math.max(1, Math.ceil(total / ARTICLE_PAGE_SIZE) || 1);
  const page = Math.min(requested, totalPages);

  try {
    articles = await withDbTimeout(
      prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * ARTICLE_PAGE_SIZE,
        take: ARTICLE_PAGE_SIZE,
        select: {
          id: true,
          publicId: true,
          title: true,
          excerpt: true,
          publishedAt: true,
          coverImageUrl: true,
          category: true,
        },
      }),
    );
  } catch {
    articles = [];
  }

  const featured = page === 1 && !q ? articles[0] : null;
  const list = featured ? articles.slice(1) : articles;
  const resultLine = q
    ? total === 0
      ? `Aucun résultat pour « ${q} » dans ${meta.label}.`
      : `${total} résultat${total > 1 ? "s" : ""} pour « ${q} ».`
    : null;

  return (
    <div className="animate-fade-up">
      <JsonLd
        data={collectionPageJsonLd({
          name: meta.label,
          description: meta.description,
          path,
        })}
      />
      <ListPageHeader
        kicker="Rubrique"
        title={meta.label}
        description={meta.description}
        basePath={path}
        q={q}
        placeholder={`Rechercher dans ${meta.label}…`}
        resultLine={resultLine}
      />

      {articles.length === 0 ? (
        <p className="py-16 text-center text-muted">
          {q
            ? "Aucun article ne correspond à cette recherche."
            : "Aucun article dans cette rubrique pour le moment."}
        </p>
      ) : (
        <div>
          {featured ? (
            <ArticleCard
              key={featured.id}
              id={featured.id}
              publicId={featured.publicId}
              title={featured.title}
              excerpt={featured.excerpt}
              publishedAt={featured.publishedAt}
              category={featured.category}
              hasCover={Boolean(featured.coverImageUrl)}
              coverUrl={featured.coverImageUrl}
              featured
              index={0}
            />
          ) : null}
          {list.map((article, index) => (
            <ArticleCard
              key={article.id}
              id={article.id}
              publicId={article.publicId}
              title={article.title}
              excerpt={article.excerpt}
              publishedAt={article.publishedAt}
              category={article.category}
              hasCover={Boolean(article.coverImageUrl)}
              coverUrl={article.coverImageUrl}
              featured={!featured && index === 0 && page === 1 && !q}
              index={featured ? index + 1 : index}
            />
          ))}
          <Pagination
            page={page}
            totalPages={totalPages}
            basePath={path}
            q={q}
          />
        </div>
      )}

      {page === 1 && !q ? (
        <section
          aria-labelledby="rubrique-presentation"
          className="mt-14 max-w-3xl border-t border-ink/10 pt-8 text-sm leading-relaxed text-muted"
        >
          <h2
            id="rubrique-presentation"
            className="font-display text-[0.8rem] tracking-[0.16em] text-ink"
          >
            La rubrique {meta.label}
          </h2>
          {meta.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mt-3">
              {paragraph}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}
