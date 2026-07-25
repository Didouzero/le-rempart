import Link from "next/link";
import { articlePublicPath } from "@/lib/article-url";

export type RelatedArticleItem = {
  publicId: number;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
};

type RelatedArticlesProps = {
  articles: RelatedArticleItem[];
};

export function RelatedArticles({ articles }: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-14 border-t border-ink pt-10" aria-labelledby="related-heading">
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Suite
      </p>
      <h2
        id="related-heading"
        className="font-display mt-2 text-2xl tracking-[0.08em] sm:text-3xl"
      >
        Dans l&apos;actualité également
      </h2>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />

      <ul className="mt-8 grid list-none gap-6 p-0 sm:grid-cols-3">
        {articles.map((item) => {
          const href = articlePublicPath(item.publicId);
          const shortTitle =
            item.title.length > 72 ? `${item.title.slice(0, 69).trim()}…` : item.title;

          return (
            <li key={item.publicId}>
              <Link
                href={href}
                className="group block no-underline hover:no-underline"
              >
                {item.coverImageUrl ? (
                  <div className="media-frame aspect-[16/10] w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.coverImageUrl} alt="" />
                  </div>
                ) : (
                  <div className="flex aspect-[16/10] w-full items-end bg-ink p-3">
                    <span className="font-display text-sm tracking-[0.12em] text-accent">
                      Le Rempart
                    </span>
                  </div>
                )}
                <h3 className="font-display mt-3 text-lg leading-[1.1] text-ink transition-colors group-hover:text-accent-deep">
                  {shortTitle}
                </h3>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
