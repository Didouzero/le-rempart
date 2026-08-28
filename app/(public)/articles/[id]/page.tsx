import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { ArticleBody } from "@/components/ArticleBody";
import { JsonLd } from "@/components/JsonLd";
import { RelatedArticles } from "@/components/RelatedArticles";
import { articlePublicPath, articlePublicUrl } from "@/lib/article-url";
import {
  categoryLabel,
  categoryPath,
  type ArticleCategory,
} from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { findRelatedArticles } from "@/lib/related-articles";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildPageMetadata,
  newsArticleJsonLd,
  SITE_LOGO_SQUARE,
  SITE_NAME,
} from "@/lib/seo";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

type ArticleRow = {
  id: string;
  publicId: number;
  title: string;
  excerpt: string;
  content: string;
  publishedAt: Date | null;
  updatedAt: Date;
  coverImageUrl: string | null;
  category: ArticleCategory;
};

async function findByPublicId(publicId: number): Promise<ArticleRow | null> {
  return withDbTimeout(
    prisma.article.findFirst({
      where: { publicId, status: "published" },
      select: {
        id: true,
        publicId: true,
        title: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        updatedAt: true,
        coverImageUrl: true,
        category: true,
      },
    }),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const asNumber = Number(id);
  if (!Number.isInteger(asNumber) || asNumber <= 0) {
    return { title: SITE_NAME };
  }
  try {
    const article = await findByPublicId(asNumber);
    if (!article) return { title: "Article introuvable" };

    const path = articlePublicPath(article.publicId);
    const url = articlePublicUrl(article.publicId);
    const imageUrl = article.coverImageUrl || absoluteUrl(SITE_LOGO_SQUARE);
    const section = categoryLabel(article.category);

    return {
      ...buildPageMetadata({
        title: article.title,
        description: article.excerpt,
        path,
        ogType: "article",
        image: imageUrl,
        imageAlt: article.title,
      }),
      // Le template ajoute déjà « — Le Rempart » ; OG title = titre seul + siteName
      openGraph: {
        title: article.title,
        description: article.excerpt,
        type: "article",
        url,
        siteName: SITE_NAME,
        locale: "fr_FR",
        publishedTime: article.publishedAt?.toISOString(),
        modifiedTime: article.updatedAt?.toISOString(),
        section,
        authors: ["Rédaction Le Rempart"],
        images: [{ url: imageUrl, alt: article.title }],
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description: article.excerpt,
        images: [imageUrl],
      },
    };
  } catch {
    return { title: SITE_NAME };
  }
}

function formatDate(value: Date | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;
  const asNumber = Number(id);

  if (!Number.isInteger(asNumber) || asNumber <= 0) {
    try {
      const bySlug = await withDbTimeout(
        prisma.article.findFirst({
          where: { slug: id, status: "published" },
          select: { publicId: true },
        }),
      );
      if (bySlug) permanentRedirect(articlePublicPath(bySlug.publicId));
    } catch {
      notFound();
    }
    notFound();
  }

  let article: ArticleRow | null = null;
  try {
    article = await findByPublicId(asNumber);
  } catch {
    notFound();
  }

  if (!article) notFound();

  let related: Awaited<ReturnType<typeof findRelatedArticles>> = [];
  try {
    related = await findRelatedArticles({
      excludeId: article.id,
      category: article.category,
      title: article.title,
      excerpt: article.excerpt,
    });
  } catch {
    related = [];
  }

  const url = articlePublicUrl(article.publicId);
  const section = categoryLabel(article.category);
  const rubriquePath = categoryPath(article.category);

  return (
    <article className="animate-fade-up">
      <JsonLd
        data={newsArticleJsonLd({
          title: article.title,
          excerpt: article.excerpt,
          url,
          imageUrl: article.coverImageUrl,
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
          section,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Dernières news", path: "/" },
          { name: section, path: rubriquePath },
          { name: article.title, path: articlePublicPath(article.publicId) },
        ])}
      />

      <nav aria-label="Fil d'Ariane" className="mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link
              href="/"
              className="font-display tracking-[0.1em] text-ink no-underline underline-offset-4 hover:text-accent-deep hover:underline"
            >
              Dernières news
            </Link>
          </li>
          <li aria-hidden className="text-accent">
            /
          </li>
          <li>
            <Link
              href={rubriquePath}
              className="font-display tracking-[0.1em] text-ink no-underline underline-offset-4 hover:text-accent-deep hover:underline"
            >
              {section}
            </Link>
          </li>
          <li aria-hidden className="text-accent">
            /
          </li>
          <li className="max-w-[min(100%,28rem)] truncate text-muted">
            {article.title}
          </li>
        </ol>
      </nav>

      <header className="mb-8 pb-8">
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          <Link
            href={rubriquePath}
            className="text-inherit no-underline hover:underline"
          >
            {section}
          </Link>
        </p>
        <time
          className="mt-3 block text-xs uppercase tracking-[0.14em] text-muted"
          dateTime={article.publishedAt?.toISOString()}
        >
          {formatDate(article.publishedAt)}
        </time>
        <h1 className="font-display mt-3 text-[1.75rem] leading-[1.05] sm:text-3xl md:text-4xl">
          {article.title}
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">
          Par la rédaction Le Rempart
        </p>
        <div className="gold-rule animate-line-grow mt-5 max-w-md" />
        <p className="mt-5 max-w-2xl text-lg italic text-black">
          {article.excerpt}
        </p>
      </header>

      {article.coverImageUrl ? (
        <div className="media-frame mb-10 max-h-[32rem] w-full shadow-[var(--shadow-soft)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.coverImageUrl}
            alt={article.title}
            className="max-h-[32rem] w-full object-cover"
          />
        </div>
      ) : null}

      <ArticleBody content={article.content} />

      <AdSlot slot="article-bottom" />

      <RelatedArticles articles={related} />
    </article>
  );
}
