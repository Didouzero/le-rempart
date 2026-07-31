import { AdSlot } from "@/components/AdSlot";
import { ArticleCard } from "@/components/ArticleCard";
import { CategoryTiles } from "@/components/CategoryTiles";
import { Pagination } from "@/components/Pagination";
import { prisma, withDbTimeout } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const requested = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);

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
    total = await withDbTimeout(
      prisma.article.count({ where: { status: "published" } }),
    );
  } catch {
    total = 0;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const page = Math.min(requested, totalPages);

  try {
    articles = await withDbTimeout(
      prisma.article.findMany({
        where: { status: "published" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
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

  const featured = page === 1 ? articles[0] : null;
  const list = page === 1 ? articles.slice(1) : articles;

  return (
    <div>
      <AdSlot slot="home-below-header" />

      <div className="mb-8 animate-fade-up">
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          Fil d&apos;actualité
        </p>
        <h1 className="font-display mt-2 text-4xl tracking-[0.08em] sm:text-5xl">
          Actualités
        </h1>
        <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
      </div>

      {articles.length === 0 ? (
        <p className="py-16 text-center text-muted">
          Aucun article publié pour le moment.
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
                {page === 1 ? "Dernières publications" : `Page ${page}`}
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

          <Pagination page={page} totalPages={totalPages} />
        </div>
      )}

      <CategoryTiles />
    </div>
  );
}
