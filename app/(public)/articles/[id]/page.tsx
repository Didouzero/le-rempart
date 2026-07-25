import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { ArticleBody } from "@/components/ArticleBody";
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const asNumber = Number(id);
  if (!Number.isInteger(asNumber) || asNumber <= 0) {
    return { title: "Le Rempart" };
  }
  try {
    const article = await findByPublicId(asNumber);
    if (!article) return { title: "Article introuvable" };
    return {
      title: article.title,
      description: article.excerpt,
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

  return (
    <article className="animate-fade-up">
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
        <p className="mt-5 max-w-2xl text-lg italic text-ink/80">{article.excerpt}</p>
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
    </article>
  );
}
