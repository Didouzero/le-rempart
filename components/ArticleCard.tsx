import Link from "next/link";

type ArticleCardProps = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | string | null;
  hasCover?: boolean;
  coverUrl?: string | null;
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

export function ArticleCard({
  id,
  slug,
  title,
  excerpt,
  publishedAt,
  hasCover,
  coverUrl,
}: ArticleCardProps) {
  const src = coverUrl || (hasCover && id ? `/api/media/${id}` : null);

  return (
    <article className="animate-fade-up border-b border-rule py-8 first:pt-0">
      {src ? (
        <Link href={`/articles/${slug}`} className="mb-4 block no-underline hover:no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="aspect-[16/9] w-full object-cover"
          />
        </Link>
      ) : null}
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
