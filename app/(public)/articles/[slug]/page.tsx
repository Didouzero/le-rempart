import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { ArticleBody } from "@/components/ArticleBody";
import { prisma, withDbTimeout } from "@/lib/prisma";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const article = await withDbTimeout(
      prisma.article.findFirst({
        where: { slug, status: "published" },
      }),
    );
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
  const { slug } = await params;

  let article = null;
  try {
    article = await withDbTimeout(
      prisma.article.findFirst({
        where: { slug, status: "published" },
      }),
    );
  } catch {
    notFound();
  }

  if (!article) notFound();

  return (
    <article className="animate-fade-up">
      <header className="mb-8 border-b border-rule pb-8">
        <time
          className="text-sm text-muted"
          dateTime={article.publishedAt?.toISOString()}
        >
          {formatDate(article.publishedAt)}
        </time>
        <h1 className="font-display mt-3 text-3xl leading-[1.1] sm:text-5xl">
          {article.title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink/80">{article.excerpt}</p>
      </header>

      <ArticleBody content={article.content} />

      <AdSlot slot="article-bottom" />
    </article>
  );
}
