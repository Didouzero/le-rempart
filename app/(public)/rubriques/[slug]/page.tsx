import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { JsonLd } from "@/components/JsonLd";
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
};

export const dynamic = "force-dynamic";

const CATEGORY_OG_IMAGE: Partial<Record<ArticleCategory, string>> = {
  immigration: "/rubriques/immigration.webp",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isArticleCategory(slug)) return { title: "Rubrique" };
  const meta = CATEGORY_META[slug];
  const path = `/rubriques/${meta.slug}`;
  const image = CATEGORY_OG_IMAGE[slug]
    ? absoluteUrl(CATEGORY_OG_IMAGE[slug]!)
    : undefined;

  return buildPageMetadata({
    title: meta.label,
    description: meta.description,
    path,
    image,
    imageAlt: `Rubrique ${meta.label} — Le Rempart`,
  });
}

export default async function RubriquePage({ params }: Props) {
  const { slug } = await params;
  if (!isArticleCategory(slug)) notFound();

  const category = slug as ArticleCategory;
  const meta = CATEGORY_META[category];
  const path = `/rubriques/${meta.slug}`;

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
    articles = await withDbTimeout(
      prisma.article.findMany({
        where: { status: "published", category },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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
      </div>

      {articles.length === 0 ? (
        <p className="py-16 text-center text-muted">
          Aucun article dans cette rubrique pour le moment.
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
              featured={index === 0}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
