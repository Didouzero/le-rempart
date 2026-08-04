import Link from "next/link";
import {
  ARTICLE_CATEGORIES,
  CATEGORY_META,
  type ArticleCategory,
} from "@/lib/categories";

/** Fonds thématiques (Unsplash) pour les tuiles rubriques. */
const TILE_IMAGES: Record<ArticleCategory, string> = {
  immigration:
    "https://images.unsplash.com/photo-1590073844006-33379778ae09?w=800&h=800&fit=crop&q=80",
  justice:
    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=800&fit=crop&q=80",
  economie:
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&h=800&fit=crop&q=80",
  politique:
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=800&fit=crop&q=80",
  insolite:
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=800&fit=crop&q=80",
};

export function CategoryTiles() {
  return (
    <section className="mt-14 animate-fade-up" aria-label="Rubriques">
      <p className="section-kicker mb-2">
        <span className="live-dot" aria-hidden />
        Rubriques
      </p>
      <div className="gold-rule mb-6 max-w-[12rem]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {ARTICLE_CATEGORIES.map((key) => {
          const meta = CATEGORY_META[key];
          return (
            <Link
              key={key}
              href={`/rubriques/${meta.slug}`}
              className="group relative aspect-square overflow-hidden bg-ink no-underline shadow-[var(--shadow-soft)] hover:no-underline"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={TILE_IMAGES[key]}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-105 group-hover:opacity-55"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-3 text-center font-display text-[0.95rem] tracking-[0.14em] text-white sm:text-lg">
                {meta.label}
              </span>
              <span className="absolute left-0 top-0 h-1 w-full bg-accent opacity-90" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
