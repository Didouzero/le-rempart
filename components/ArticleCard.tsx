import Link from "next/link";
import { CoverImg } from "@/components/CoverImg";
import { articlePublicPath } from "@/lib/article-url";
import {
  categoryLabel,
  categoryPath,
  type ArticleCategory,
} from "@/lib/categories";
import { PublishedAt } from "@/components/PublishedAt";

type ArticleCardProps = {
  id?: string;
  publicId: number;
  title: string;
  excerpt: string;
  publishedAt: Date | string | null;
  category?: ArticleCategory | string | null;
  hasCover?: boolean;
  coverUrl?: string | null;
  featured?: boolean;
  index?: number;
};

export function ArticleCard({
  id,
  publicId,
  title,
  excerpt,
  publishedAt,
  category,
  hasCover,
  coverUrl,
  featured = false,
  index = 0,
}: ArticleCardProps) {
  const href = articlePublicPath(publicId);
  const src = coverUrl || (hasCover && id ? `/api/media/${id}` : null);
  const delayClass =
    index === 0 ? "" : index === 1 ? "delay-1" : index === 2 ? "delay-2" : "delay-3";
  const cat = category as ArticleCategory | undefined;
  const catLabel = category ? categoryLabel(category) : null;

  if (featured) {
    return (
      <article className={`group animate-fade-up ${delayClass}`}>
        <Link href={href} className="block no-underline hover:no-underline">
          {src ? (
            <div className="media-frame aspect-[16/9] w-full shadow-[var(--shadow-soft)]">
              <CoverImg
                url={src}
                alt={title}
                sizes="(min-width: 1152px) 72rem, 100vw"
                priority
              />
            </div>
          ) : (
            <div className="flex aspect-[21/9] w-full items-end rounded-lg bg-ink p-6 sm:p-10">
              <span className="font-display text-2xl tracking-[0.12em] text-accent">
                À la une
              </span>
            </div>
          )}
        </Link>
        <div className="mt-5 border-l-[3px] border-accent pl-4 sm:pl-5">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.14em] text-muted">
            <span className="font-display text-gold">À la une</span>
            {cat && catLabel ? (
              <>
                <span aria-hidden>•</span>
                <Link
                  href={categoryPath(cat)}
                  className="font-display text-gold no-underline hover:underline"
                >
                  {catLabel}
                </Link>
              </>
            ) : null}
            <span aria-hidden>•</span>
            <PublishedAt value={publishedAt} />
          </div>
          <h2 className="font-headline mt-3 text-2xl leading-[1.12] sm:text-3xl md:text-4xl">
            <Link href={href} className="no-underline hover:text-gold hover:no-underline">
              {title}
            </Link>
          </h2>
          <p className="mt-3 line-clamp-3 max-w-3xl text-base leading-relaxed text-muted sm:text-[1.05rem]">{excerpt}</p>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-4 border-b border-rule py-5 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-6 sm:py-6 ${delayClass}`}
    >
      {src ? (
        <Link href={href} className="block no-underline hover:no-underline">
          <div className="media-frame aspect-[16/9] w-full">
            <CoverImg url={src} alt={title} sizes="(min-width: 640px) 15rem, 8rem" />
          </div>
        </Link>
      ) : (
        <div className="aspect-[16/9] rounded-[var(--radius)] bg-ink/5" />
      )}
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.12em] text-muted">
          {cat && catLabel ? (
            <Link
              href={categoryPath(cat)}
              className="font-display text-gold no-underline hover:underline"
            >
              {catLabel}
            </Link>
          ) : null}
          {cat && catLabel ? <span aria-hidden className="hidden sm:inline">•</span> : null}
          <PublishedAt value={publishedAt} />
        </div>
        <h2 className="font-headline mt-1 text-[1.05rem] leading-[1.25] sm:mt-2 sm:text-[1.4rem] sm:leading-[1.2]">
          <Link href={href} className="no-underline hover:text-gold hover:no-underline">
            {title}
          </Link>
        </h2>
        <div className="hidden sm:block">
          <p className="mt-2 line-clamp-2 max-w-2xl text-[0.98rem] leading-snug text-muted">{excerpt}</p>
        </div>
      </div>
    </article>
  );
}
