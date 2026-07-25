import Link from "next/link";
import { articlePublicPath } from "@/lib/article-url";

type ArticleCardProps = {
  id?: string;
  publicId: number;
  title: string;
  excerpt: string;
  publishedAt: Date | string | null;
  hasCover?: boolean;
  coverUrl?: string | null;
  featured?: boolean;
  index?: number;
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
  publicId,
  title,
  excerpt,
  publishedAt,
  hasCover,
  coverUrl,
  featured = false,
  index = 0,
}: ArticleCardProps) {
  const href = articlePublicPath(publicId);
  const src = coverUrl || (hasCover && id ? `/api/media/${id}` : null);
  const delayClass =
    index === 0 ? "" : index === 1 ? "delay-1" : index === 2 ? "delay-2" : "delay-3";

  if (featured) {
    return (
      <article className={`group animate-fade-up ${delayClass}`}>
        <Link href={href} className="block no-underline hover:no-underline">
          {src ? (
            <div className="media-frame aspect-[16/9] w-full shadow-[var(--shadow-soft)] sm:aspect-[21/9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </div>
          ) : (
            <div className="flex aspect-[21/9] w-full items-end bg-ink p-6 sm:p-10">
              <span className="font-display text-2xl tracking-[0.12em] text-accent">
                À la une
              </span>
            </div>
          )}
        </Link>
        <div className="mt-5 border-l-[3px] border-accent pl-4 sm:pl-5">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.14em] text-muted">
            <span className="font-display text-accent">À la une</span>
            <span aria-hidden>•</span>
            <time dateTime={publishedAt ? new Date(publishedAt).toISOString() : undefined}>
              {formatDate(publishedAt)}
            </time>
          </div>
          <h2 className="font-display mt-3 text-2xl leading-[1.05] sm:text-3xl md:text-4xl">
            <Link href={href} className="no-underline hover:text-accent-deep hover:no-underline">
              {title}
            </Link>
          </h2>
          <p className="mt-4 max-w-3xl text-base italic text-black sm:text-lg">{excerpt}</p>
          <Link href={href} className="read-link mt-5">
            Lire l&apos;article →
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group animate-fade-up grid gap-5 border-b border-rule py-8 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] sm:items-center ${delayClass}`}
    >
      {src ? (
        <Link href={href} className="block no-underline hover:no-underline">
          <div className="media-frame aspect-[16/10] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" />
          </div>
        </Link>
      ) : (
        <div className="hidden aspect-[16/10] bg-ink/5 sm:block" />
      )}
      <div>
        <time
          className="text-xs uppercase tracking-[0.14em] text-muted"
          dateTime={publishedAt ? new Date(publishedAt).toISOString() : undefined}
        >
          {formatDate(publishedAt)}
        </time>
        <h2 className="font-display mt-2 text-xl leading-[1.08] sm:text-2xl">
          <Link href={href} className="no-underline hover:text-accent-deep hover:no-underline">
            {title}
          </Link>
        </h2>
        <p className="mt-3 max-w-2xl text-base italic text-black">{excerpt}</p>
        <Link href={href} className="read-link mt-4">
          Lire l&apos;article →
        </Link>
      </div>
    </article>
  );
}
