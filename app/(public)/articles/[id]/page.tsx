import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { ArticleBody } from "@/components/ArticleBody";
import { ArticleSideAds } from "@/components/ArticleSideAds";
import { JsonLd } from "@/components/JsonLd";
import { NativeAdsRail } from "@/components/NativeAdsRail";
import { RelatedArticles } from "@/components/RelatedArticles";
import { PublishedAt } from "@/components/PublishedAt";
import { authorFromPublicId } from "@/lib/authors";
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
import { hasActiveRempartPlus } from "@/lib/membership";

type Props = {
  params: Promise<{ id: string }>;
};

function breadcrumbTitle(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= 33) return t;
  return `${t.slice(0, 33).trimEnd()}...`;
}

export const dynamic = "force-dynamic";

type ArticleRow = {
  id: string;
  publicId: number;
  title: string;
  excerpt: string;
  content: string;
  authorName: string | null;
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
        authorName: true,
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
    const author =
      article.authorName?.trim() || authorFromPublicId(article.publicId);

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
        authors: [author],
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
  const plus = await hasActiveRempartPlus();
  const rubriquePath = categoryPath(article.category);
  const author =
    article.authorName?.trim() || authorFromPublicId(article.publicId);

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
          authorName: author,
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
          <li className="text-muted">
            {breadcrumbTitle(article.title)}
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
        <PublishedAt
          value={article.publishedAt}
          className="mt-3 block text-xs uppercase tracking-[0.14em] text-muted"
        />
        <h1 className="font-display mt-3 text-[1.75rem] leading-[1.05] sm:text-3xl md:text-4xl">
          {article.title}
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">
          Par {author}
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

      <ArticleSideAds show={!plus}>
        <ArticleBody
          content={article.content}
          showNewsletterCta
          showInArticleAd={!plus}
        />
      </ArticleSideAds>

      <AdSlot slot="article-bottom" />

      {plus ? null : <NativeAdsRail />}

      <RelatedArticles articles={related} />
    </article>
  );
}
