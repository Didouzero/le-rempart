import Link from "next/link";
import { CoverImg } from "@/components/CoverImg";
import { articlePublicPath } from "@/lib/article-url";

export type RelatedArticleItem = {
  publicId: number;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
};

type RelatedArticlesProps = {
  articles: RelatedArticleItem[];
  kicker?: string;
  title?: string;
};

export function RelatedArticles({
  articles,
  title = "Dans l'actualité également",
}: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-14 border-t border-rule pt-8" aria-labelledby="related-heading">
      <h2 id="related-heading" className="font-display text-[1.15rem] tracking-[0.08em]">
        {title}
      </h2>

      {/* Titres entiers : sur mobile vignette à gauche, sur grand écran trois colonnes. */}
      <ul className="mt-4 grid list-none gap-0 p-0 sm:grid-cols-3 sm:gap-6">
        {articles.map((item) => {
          const href = articlePublicPath(item.publicId);
          return (
            <li
              key={item.publicId}
              className="border-b border-rule py-4 first:pt-0 sm:border-b-0 sm:py-0"
            >
              <Link
                href={href}
                className="group grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 no-underline hover:no-underline sm:block"
              >
                {item.coverImageUrl ? (
                  <div className="media-frame aspect-[16/9] w-full">
                    <CoverImg
                      url={item.coverImageUrl}
                      alt=""
                      sizes="(min-width: 640px) 33vw, 8rem"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] w-full rounded-[var(--radius)] bg-ink/10" />
                )}
                <h3 className="font-headline text-[1rem] leading-[1.28] text-ink transition-colors group-hover:text-gold sm:mt-3 sm:text-[1.1rem]">
                  {item.title}
                </h3>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
