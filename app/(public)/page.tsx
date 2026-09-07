import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { ArticleCard } from "@/components/ArticleCard";
import { ListPageHeader } from "@/components/ArticleSearch";
import { CategoryTiles } from "@/components/CategoryTiles";
import { NativeAdsRail } from "@/components/NativeAdsRail";
import { Pagination } from "@/components/Pagination";
import { RempartPlusOffer } from "@/components/RempartPlusOffer";
import {
  ARTICLE_PAGE_SIZE,
  parsePageParam,
  parseSearchQuery,
  publishedArticleWhere,
} from "@/lib/article-list";
import { hasActiveRempartPlus } from "@/lib/membership";
import { prisma, withDbTimeout } from "@/lib/prisma";
import {
  SITE_DEFAULT_TITLE,
  SITE_DESCRIPTION,
  buildPageMetadata,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ page?: string; q?: string }>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const q = parseSearchQuery(params.q);
  const isPaged = page > 1;
  const hasSearch = Boolean(q);

  if (!isPaged && !hasSearch) {
    return buildPageMetadata({
      title: SITE_DEFAULT_TITLE,
      description: SITE_DESCRIPTION,
      path: "/",
      absoluteTitle: true,
    });
  }

  const titleParts = [
    hasSearch ? `Recherche « ${q} »` : null,
    isPaged ? `page ${page}` : null,
  ].filter(Boolean);
  const title = titleParts.length
    ? `L'actualité en direct — ${titleParts.join(" — ")}`
    : "L'actualité en direct";

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (page > 1) qs.set("page", String(page));
  const path = qs.toString() ? `/?${qs}` : "/";

  return buildPageMetadata({
    title,
    description: hasSearch
      ? `Résultats pour « ${q} » sur Le Rempart.`
      : `${SITE_DESCRIPTION} Page ${page}.`,
    path,
  });
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const requested = parsePageParam(params.page);
  const q = parseSearchQuery(params.q);
  const where = publishedArticleWhere({ q });
  const plus = await hasActiveRempartPlus();

  let total = 0;
  let articles: Array<{
    id: string;
    publicId: number;
    title: string;
    excerpt: string;
    publishedAt: Date | null;
    coverImageUrl: string | null;
    category: string;
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

  const showFeatured = page === 1 && !q;
  const featured = showFeatured ? articles[0] : null;
  const list = showFeatured ? articles.slice(1) : articles;

  return (
    <div>
      <AdSlot slot="home-below-header" />

      <ListPageHeader
        kicker="Fil d'actualité"
        title="L'actualité en direct"
        basePath="/"
        q={q}
        placeholder="Rechercher dans toutes les news…"
        resultLine={
          q
            ? total === 0
              ? `Aucun résultat pour « ${q} ».`
              : `${total} résultat${total > 1 ? "s" : ""} pour « ${q} ».`
            : null
        }
      />

      {articles.length === 0 ? (
        <p className="py-16 text-center text-muted">
          {q
            ? "Aucun article ne correspond à cette recherche."
            : "Aucun article publié pour le moment."}
        </p>
      ) : (
        <div className="space-y-10">
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

          {list.length > 0 ? (
            <div>
              <p className="section-kicker mb-2">
                {q
                  ? "Résultats"
                  : page === 1
                    ? "Dernières publications"
                    : `Page ${page}`}
              </p>
              <div className="gold-rule mb-2 max-w-[12rem]" />
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
                  index={index + 1}
                />
              ))}
            </div>
          ) : null}

          <Pagination page={page} totalPages={totalPages} basePath="/" q={q} />
        </div>
      )}

      <CategoryTiles />

      <section className="mt-14 animate-fade-up" aria-label="Le Rempart+">
        <p className="section-kicker mb-2">
          <span className="live-dot" aria-hidden />
          Le Rempart+
        </p>
        <div className="gold-rule mb-6 max-w-[12rem]" />
        <RempartPlusOffer
          alreadyPlus={plus}
          showHowItWorks={false}
          titleAs="h2"
        />
      </section>

      {plus ? null : <NativeAdsRail />}
    </div>
  );
}
