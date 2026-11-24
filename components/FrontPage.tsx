import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { CoverImg } from "@/components/CoverImg";
import { JsonLd } from "@/components/JsonLd";
import { PublishedAt } from "@/components/PublishedAt";
import { RempartPlusOffer } from "@/components/RempartPlusOffer";
import { publishedArticleWhere } from "@/lib/article-list";
import { articlePublicPath } from "@/lib/article-url";
import {
  ARTICLE_CATEGORIES,
  CATEGORY_META,
  categoryLabel,
  categoryPath,
  type ArticleCategory,
} from "@/lib/categories";
import { formatPublishedAtTime } from "@/lib/format-published-at";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { websiteJsonLd } from "@/lib/seo";

const select = {
  id: true,
  publicId: true,
  title: true,
  excerpt: true,
  publishedAt: true,
  coverImageUrl: true,
  category: true,
} as const;

type Item = {
  id: string;
  publicId: number;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
  coverImageUrl: string | null;
  category: string;
};

const LATEST_COUNT = 8;
/** Assez pour accompagner la une sans laisser de vide sous les secondaires. */
const LIVE_COUNT = 8;
const PER_CATEGORY = 4;

function coverOf(item: Item): string | null {
  return item.coverImageUrl || null;
}

function parisDay(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

/** Heure si publié aujourd'hui, sinon date courte : le fil se lit comme une dépêche. */
function liveStamp(value: Date | null): string {
  if (!value) return "";
  if (parisDay(value) === parisDay(new Date())) return formatPublishedAtTime(value) || "";
  return value.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
}

function Kicker({ category }: { category: string }) {
  const label = categoryLabel(category);
  if (!label) return null;
  return (
    <Link
      href={categoryPath(category as ArticleCategory)}
      className="font-display text-[0.78rem] tracking-[0.1em] text-gold no-underline hover:underline"
    >
      {label}
    </Link>
  );
}

function Media({ item, sizes, priority = false, ratio = "aspect-[16/9]" }: { item: Item; sizes: string; priority?: boolean; ratio?: string }) {
  const src = coverOf(item);
  return (
    <Link href={articlePublicPath(item.publicId)} className="block no-underline hover:no-underline" tabIndex={-1} aria-hidden>
      {src ? (
        <div className={`media-frame ${ratio} w-full`}>
          <CoverImg url={src} alt="" sizes={sizes} priority={priority} />
        </div>
      ) : (
        <div className={`${ratio} w-full rounded-[var(--radius)] bg-ink/10`} />
      )}
    </Link>
  );
}

function Lead({ item }: { item: Item }) {
  return (
    <article className="group">
      <Media item={item} sizes="(min-width: 1024px) 46rem, 100vw" priority />
      <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs uppercase tracking-[0.12em] text-muted">
        <span className="font-display text-[0.78rem] tracking-[0.1em] text-accent">À la une</span>
        <span aria-hidden>·</span>
        <Kicker category={item.category} />
        <span aria-hidden>·</span>
        <PublishedAt value={item.publishedAt} />
      </div>
      <h2 className="font-headline mt-2 text-[1.75rem] leading-[1.12] sm:text-[2.25rem] lg:text-[2.6rem]">
        <Link href={articlePublicPath(item.publicId)} className="no-underline hover:text-gold hover:no-underline">
          {item.title}
        </Link>
      </h2>
      <p className="mt-3 max-w-3xl text-[1.05rem] leading-relaxed text-muted">{item.excerpt}</p>
    </article>
  );
}

function SmallCard({ item, showExcerpt = false }: { item: Item; showExcerpt?: boolean }) {
  return (
    <article className="group grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 sm:block">
      <Media item={item} sizes="(min-width: 1024px) 15rem, (min-width: 640px) 33vw, 8rem" />
      <div className="sm:mt-3">
        <Kicker category={item.category} />
        <h3 className="font-headline mt-1 text-[1rem] leading-[1.25] sm:text-[1.1rem]">
          <Link href={articlePublicPath(item.publicId)} className="no-underline hover:text-gold hover:no-underline">
            {item.title}
          </Link>
        </h3>
        {showExcerpt ? <p className="mt-2 hidden line-clamp-3 sm:block text-[0.95rem] leading-snug text-muted">{item.excerpt}</p> : null}
      </div>
    </article>
  );
}

function LiveColumn({ items, shown }: { items: Item[]; shown: Set<string> }) {
  return (
    <aside aria-labelledby="en-continu" className="lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-center gap-2 border-b-2 border-accent pb-2">
        <span className="live-dot" aria-hidden />
        <h2 id="en-continu" className="font-display text-[1.05rem] tracking-[0.1em]">
          En continu
        </h2>
      </div>
      <ol className="divide-y divide-rule">
        {items.map((item) => (
          <li
            key={item.id}
            className={`${shown.has(item.id) ? "hidden lg:grid" : "grid"} grid-cols-[3.25rem_minmax(0,1fr)] gap-3 py-3`}
          >
            <span className="pt-[0.15rem] text-[0.8rem] font-semibold tabular-nums text-gold">
              {liveStamp(item.publishedAt)}
            </span>
            <div>
              <Link
                href={articlePublicPath(item.publicId)}
                className="block text-[0.98rem] font-semibold leading-snug text-ink no-underline hover:text-gold hover:no-underline"
              >
                {item.title}
              </Link>
              <span className="font-display mt-1 block text-[0.7rem] tracking-[0.1em] text-muted">
                {categoryLabel(item.category)}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <Link href="/?page=2" className="read-link mt-4">
        Toutes les actualités →
      </Link>
    </aside>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-rule pb-2">
      <h2 className="font-display text-[1.35rem] tracking-[0.08em]">
        <Link href={href} className="no-underline hover:text-gold hover:no-underline">
          {title}
        </Link>
      </h2>
      <Link
        href={href}
        className="font-display shrink-0 text-[0.8rem] tracking-[0.1em] text-gold no-underline hover:underline"
      >
        Voir tout →
      </Link>
    </div>
  );
}

/** Accueil en grille de journal : manchette, secondaires, fil « En continu », puis un bloc par rubrique. */
export async function FrontPage() {
  // Pas de repli silencieux : une panne de base ne doit pas mettre en cache un accueil vide.
  const latest: Item[] = await withDbTimeout(
    prisma.article.findMany({
      where: publishedArticleWhere({}),
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: LATEST_COUNT,
      select,
    }),
  );

  const lead = latest[0];
  const secondary = latest.slice(1, 4);
  const shown = new Set([lead, ...secondary].filter(Boolean).map((a) => a.id));

  const sections = await Promise.all(
    ARTICLE_CATEGORIES.map(async (category) => {
      const items: Item[] = await withDbTimeout(
        prisma.article.findMany({
          where: { ...publishedArticleWhere({ category }), id: { notIn: [...shown] } },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          take: PER_CATEGORY,
          select,
        }),
      );
      return { category, items };
    }),
  );

  return (
    <div>
      <JsonLd data={websiteJsonLd()} />
      <h1 className="sr-only">Le Rempart : l&apos;actualité à la une</h1>
      <AdSlot slot="home-below-header" />

      {!lead ? (
        <p className="py-16 text-center text-muted">Aucun article publié pour le moment.</p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
          <div className="min-w-0">
            <Lead item={lead} />
            {secondary.length ? (
              <div className="mt-8 grid gap-7 border-t border-rule pt-7 sm:grid-cols-3 sm:gap-6">
                {secondary.map((item) => (
                  <SmallCard key={item.id} item={item} />
                ))}
              </div>
            ) : null}
          </div>
          <LiveColumn items={latest.slice(0, LIVE_COUNT)} shown={shown} />
        </div>
      )}

      <form action="/" method="get" role="search" className="mt-12 flex gap-2 border-y border-rule py-4">
        <label htmlFor="home-search" className="sr-only">
          Rechercher dans les articles
        </label>
        <input
          id="home-search"
          name="q"
          type="search"
          placeholder="Rechercher un sujet, un nom, une ville…"
          className="min-w-0 flex-1 border border-rule bg-transparent px-3 py-2 text-[0.98rem]"
        />
        <button type="submit" className="font-display bg-accent px-4 text-[0.9rem] tracking-[0.08em] text-ink">
          Rechercher
        </button>
      </form>

      {sections
        .filter((s) => s.items.length > 0)
        .map(({ category, items }) => (
          <section key={category} className="mt-12" aria-label={CATEGORY_META[category].label}>
            <SectionHead title={CATEGORY_META[category].label} href={categoryPath(category)} />
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {items.map((item) => (
                <SmallCard key={item.id} item={item} showExcerpt />
              ))}
            </div>
          </section>
        ))}

      <section className="mt-14" aria-label="Le Rempart+">
        <p className="section-kicker mb-2">
          <span className="live-dot" aria-hidden />
          Le Rempart+
        </p>
        <div className="gold-rule mb-6 max-w-[12rem]" />
        <RempartPlusOffer showHowItWorks={false} titleAs="h2" />
      </section>
    </div>
  );
}
