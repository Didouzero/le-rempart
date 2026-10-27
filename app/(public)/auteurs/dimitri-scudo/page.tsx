import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { JsonLd } from "@/components/JsonLd";
import { Pagination } from "@/components/Pagination";
import { ARTICLE_PAGE_SIZE, parsePageParam } from "@/lib/article-list";
import { SITE_AUTHOR } from "@/lib/authors";
import type { ArticleCategory } from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";
import {
  ABOUT_PATH,
  absoluteUrl,
  authorPersonJsonLd,
  buildPageMetadata,
} from "@/lib/seo";

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export const dynamic = "force-dynamic";

const DESCRIPTION = `${SITE_AUTHOR.name}, ${SITE_AUTHOR.jobTitle.toLowerCase()} du Rempart : ligne éditoriale, méthode de travail et derniers articles publiés.`;

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const page = parsePageParam((await searchParams).page);
  return buildPageMetadata({
    title: page > 1 ? `${SITE_AUTHOR.name}, page ${page}` : SITE_AUTHOR.name,
    description: DESCRIPTION,
    path: page > 1 ? `${SITE_AUTHOR.path}?page=${page}` : SITE_AUTHOR.path,
    ogType: "website",
  });
}

export default async function AuthorPage({ searchParams }: Props) {
  const requested = parsePageParam((await searchParams).page);
  const where = { status: "published" as const, authorName: SITE_AUTHOR.name };

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

  return (
    <div className="animate-fade-up">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: absoluteUrl(SITE_AUTHOR.path),
          name: SITE_AUTHOR.name,
          inLanguage: "fr-FR",
          mainEntity: {
            ...authorPersonJsonLd(),
            description: DESCRIPTION,
          },
        }}
      />

      <header className="mb-10 max-w-3xl">
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          Auteur
        </p>
        <h1 className="font-display mt-2 text-4xl tracking-[0.08em] sm:text-5xl">
          {SITE_AUTHOR.name}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">
          {SITE_AUTHOR.jobTitle}
        </p>
        <div className="gold-rule animate-line-grow mt-3 max-w-xs" />

        <div className="prose-article mt-8">
          <p>
            {SITE_AUTHOR.name} a fondé Le Rempart en 2025 et en assure la
            direction éditoriale. Il choisit les sujets traités, fixe
            l&apos;angle de chaque article et répond de la ligne du média.
          </p>
          <p>
            Ses domaines de prédilection : l&apos;immigration, la justice et la
            sécurité, l&apos;usage de l&apos;argent public et la vie politique
            française.
          </p>
          <p>
            Les articles signés de son nom sont préparés avec l&apos;aide
            d&apos;outils d&apos;intelligence artificielle, à partir de sources
            de presse, de décisions de justice et de déclarations publiques, puis
            publiés sous sa responsabilité. La méthode complète est décrite dans
            la page <Link href={ABOUT_PATH}>Qui sommes-nous</Link>.
          </p>
          <p>
            Pour lui écrire, signaler une erreur ou exercer un droit de réponse :{" "}
            <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a>.
          </p>
        </div>
      </header>

      <h2 className="font-display mb-4 text-2xl tracking-[0.08em]">
        Ses articles{total ? ` (${total})` : ""}
      </h2>
      {articles.length === 0 ? (
        <p className="py-16 text-center text-muted">
          Aucun article publié pour le moment.
        </p>
      ) : (
        <div>
          {articles.map((article, index) => (
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
              index={index}
            />
          ))}
          <Pagination
            page={page}
            totalPages={totalPages}
            basePath={SITE_AUTHOR.path}
          />
        </div>
      )}
    </div>
  );
}
