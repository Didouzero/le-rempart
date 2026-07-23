import { AdSlot } from "@/components/AdSlot";
import { ArticleCard } from "@/components/ArticleCard";
import { prisma, withDbTimeout } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let articles: Awaited<ReturnType<typeof prisma.article.findMany>> = [];

  try {
    articles = await withDbTimeout(
      prisma.article.findMany({
        where: { status: "published" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      }),
    );
  } catch {
    articles = [];
  }

  return (
    <div>
      <AdSlot slot="home-below-header" />

      <div className="mb-8 border-b border-rule pb-4">
        <h1 className="font-display text-3xl sm:text-4xl">Actualités</h1>
        <p className="mt-2 text-muted">Les derniers articles publiés.</p>
      </div>

      {articles.length === 0 ? (
        <p className="py-16 text-center text-muted">
          Aucun article publié pour le moment.
        </p>
      ) : (
        <div>
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              slug={article.slug}
              title={article.title}
              excerpt={article.excerpt}
              publishedAt={article.publishedAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
