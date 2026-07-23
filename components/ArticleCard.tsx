import Link from "next/link";

type ArticleCardProps = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | string | null;
};

function formatDate(value: Date | string | null): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function ArticleCard({ slug, title, excerpt, publishedAt }: ArticleCardProps) {
  return (
    <article className="animate-fade-up border-b border-rule py-8 first:pt-0">
      <time className="text-sm text-muted" dateTime={publishedAt ? new Date(publishedAt).toISOString() : undefined}>
        {formatDate(publishedAt)}
      </time>
      <h2 className="font-display mt-2 text-2xl leading-tight sm:text-3xl">
        <Link href={`/articles/${slug}`}>{title}</Link>
      </h2>
      <p className="mt-3 max-w-2xl text-base text-ink/85">{excerpt}</p>
      <Link
        href={`/articles/${slug}`}
        className="mt-4 inline-block text-sm font-semibold tracking-wide underline-offset-4"
      >
        Lire l&apos;article
      </Link>
    </article>
  );
}
