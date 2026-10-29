import { AdSlot } from "@/components/AdSlot";
import { ArticleCard } from "@/components/ArticleCard";
import { ListPageHeader } from "@/components/ArticleSearch";
import { CategoryTiles } from "@/components/CategoryTiles";
import { JsonLd } from "@/components/JsonLd";
import { Pagination } from "@/components/Pagination";
import { RempartPlusOffer } from "@/components/RempartPlusOffer";
import { ARTICLE_PAGE_SIZE, publishedArticleWhere } from "@/lib/article-list";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { websiteJsonLd } from "@/lib/seo";

/** Fil de l'accueil : page 1 en cache CDN (/), pages suivantes et recherche à la demande (/accueil). */
export async function HomeFeed({
  requested,
  q,
}: {
  requested: number;
  q: string;
}) {
  const where = publishedArticleWhere({ q });

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

  // Pas de repli silencieux : une panne de base ne doit pas mettre en cache un accueil vide.
  total = await withDbTimeout(prisma.article.count({ where }));

  const totalPages = Math.max(1, Math.ceil(total / ARTICLE_PAGE_SIZE) || 1);
  const page = Math.min(requested, totalPages);

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

  const showFeatured = page === 1 && !q;
  const featured = showFeatured ? articles[0] : null;
  const list = showFeatured ? articles.slice(1) : articles;

  return (
    <div>
      {!q && page === 1 ? <JsonLd data={websiteJsonLd()} /> : null}
      <AdSlot slot="home-below-header" />

      <ListPageHeader
        kicker="Fil d'actualité"
        title="L'actualité à la une"
        hiddenTitlePrefix={!q && page === 1 ? "Le Rempart : " : undefined}
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
        <RempartPlusOffer showHowItWorks={false} titleAs="h2" />
      </section>
    </div>
  );
}
