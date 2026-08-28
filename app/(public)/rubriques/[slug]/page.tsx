import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleSearch } from "@/components/ArticleSearch";
import { JsonLd } from "@/components/JsonLd";
import { Pagination } from "@/components/Pagination";
import {
  ARTICLE_PAGE_SIZE,
  parsePageParam,
  parseSearchQuery,
  publishedArticleWhere,
} from "@/lib/article-list";
import {
  CATEGORY_META,
  isArticleCategory,
  type ArticleCategory,
} from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";
import {
  absoluteUrl,
  buildPageMetadata,
  collectionPageJsonLd,
} from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
};

export const dynamic = "force-dynamic";

const CATEGORY_OG_IMAGE: Partial<Record<ArticleCategory, string>> = {
  immigration: "/rubriques/immigration.webp",
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isArticleCategory(slug)) return { title: "Rubrique" };
  const meta = CATEGORY_META[slug];
  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const q = parseSearchQuery(sp.q);
  const pathBase = `/rubriques/${meta.slug}`;
  const image = CATEGORY_OG_IMAGE[slug]
    ? absoluteUrl(CATEGORY_OG_IMAGE[slug]!)
    : undefined;

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (page > 1) qs.set("page", String(page));
  const path = qs.toString() ? `${pathBase}?${qs}` : pathBase;

  const titleParts = [
    meta.label,
    q ? `« ${q} »` : null,
    page > 1 ? `page ${page}` : null,
  ].filter(Boolean);

  return buildPageMetadata({
    title: titleParts.join(" — "),
    description: q
      ? `Recherche « ${q} » dans la rubrique ${meta.label} — Le Rempart.`
      : meta.description,
    path,
    image,
    imageAlt: `Rubrique ${meta.label} — Le Rempart`,
  });
}

export default async function RubriquePage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!isArticleCategory(slug)) notFound();

  const category = slug as ArticleCategory;
  const meta = CATEGORY_META[category];
  const path = `/rubriques/${meta.slug}`;
  const sp = await searchParams;
  const requested = parsePageParam(sp.page);
  const q = parseSearchQuery(sp.q);
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

  return (
    <div className="animate-fade-up">
      <JsonLd
        data={collectionPageJsonLd({
          name: meta.label,
          description: meta.description,
          path,
        })}
      />
      <div className="mb-8">
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          Rubrique
        </p>
        <h1 className="font-display mt-2 text-4xl tracking-[0.08em] sm:text-5xl">
          {meta.label}
        </h1>
        <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
        <p className="mt-4 max-w-2xl text-base text-muted">{meta.description}</p>
        <ArticleSearch
          basePath={path}
          q={q}
          placeholder={`Rechercher dans ${meta.label}…`}
        />
        {q ? (
          <p className="mt-3 text-sm text-muted">
            {total === 0
              ? `Aucun résultat pour « ${q} » dans ${meta.label}.`
              : `${total} résultat${total > 1 ? "s" : ""} pour « ${q} ».`}
          </p>
        ) : null}
      </div>

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
    </div>
  );
}
