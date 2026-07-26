import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { ArticleBody } from "@/components/ArticleBody";
import { RelatedArticles } from "@/components/RelatedArticles";
import { articlePublicPath } from "@/lib/article-url";
import { prisma, withDbTimeout } from "@/lib/prisma";

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
  coverImageUrl: string | null;
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
        coverImageUrl: true,
      },
    }),
  );
}

async function findRelated(excludeId: string) {
  return withDbTimeout(
    prisma.article.findMany({
      where: { status: "published", NOT: { id: excludeId } },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: {
        publicId: true,
        title: true,
        excerpt: true,
        coverImageUrl: true,
      },
    }),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const asNumber = Number(id);
  if (!Number.isInteger(asNumber) || asNumber <= 0) {
    return { title: "Le Rempart" };
  }
  try {
    const article = await findByPublicId(asNumber);
    if (!article) return { title: "Article introuvable" };

    const url = `https://www.le-rempart.org/articles/${article.publicId}`;
    // Photo d'article en priorité — sinon favicon carré (évite le crop grotesque du logo large)
    const imageUrl =
      article.coverImageUrl || "https://www.le-rempart.org/favicon.png";

    return {
      title: article.title,
      description: article.excerpt,
      alternates: { canonical: url },
      openGraph: {
        title: article.title,
        description: article.excerpt,
        type: "article",
        url,
        siteName: "Le Rempart",
        locale: "fr_FR",
        images: [
          {
            url: imageUrl,
            alt: article.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description: article.excerpt,
        images: [imageUrl],
      },
    };
  } catch {
    return { title: "Le Rempart" };
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

  // Anciennes URLs slug → redirect
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

  let related: Awaited<ReturnType<typeof findRelated>> = [];
  try {
    related = await findRelated(article.id);
  } catch {
    related = [];
  }

  return (
    <article className="animate-fade-up">
      <nav aria-label="Fil d'Ariane" className="mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link
              href="/"
              className="font-display tracking-[0.1em] text-ink no-underline underline-offset-4 hover:text-accent-deep hover:underline"
            >
              Actualités
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
          Article
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
        <div className="gold-rule animate-line-grow mt-5 max-w-md" />
        <p className="mt-5 max-w-2xl text-lg italic text-black">{article.excerpt}</p>
      </header>

      {article.coverImageUrl ? (
        <div className="media-frame mb-10 max-h-[32rem] w-full shadow-[var(--shadow-soft)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.coverImageUrl}
            alt=""
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
