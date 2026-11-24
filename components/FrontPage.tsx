import Link from "next/link";
import { ArrowRightIcon } from "@/components/ArrowRightIcon";
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
import { mostReadPublicIds } from "@/lib/article-views";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { websiteJsonLd } from "@/lib/seo";
import { relatedByTags, tagPath, trendingTags } from "@/lib/tags";

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

/** La une, 3 secondaires, puis le fil « En continu ». */
// Six titres sous la une (deux rangées) et six dans la colonne « En direct » :
// les deux colonnes de l'accueil gardent la même hauteur, sans trou sous la une.
const SECONDARY_COUNT = 6;
const LIVE_COUNT = 6;
/** Titres ajoutés à « En continu » quand la une a son bloc « Sur le même sujet ». */
const LIVE_EXTRA_WITH_RELATED = 1;
const LATEST_COUNT = 1 + SECONDARY_COUNT + LIVE_COUNT + LIVE_EXTRA_WITH_RELATED;
// Un article en avant et quatre à côté : la colonne de droite descend aussi bas que la gauche.
const PER_CATEGORY = 5;

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

/** « Mardi 24 novembre 2026 », à l'heure de Paris. */
function todayLabel(): string {
  const s = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
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

type Related = { id: string; publicId: number; title: string };

function Lead({ item, related = [] }: { item: Item; related?: Related[] }) {
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
      {related.length ? (
        <div className="mt-5 border-l-[3px] border-accent pl-4">
          <p className="font-display text-[0.75rem] tracking-[0.16em] text-gold">Sur le même sujet</p>
          <ul className="mt-1.5 space-y-1.5">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={articlePublicPath(r.publicId)}
                  className="font-headline text-[1rem] leading-[1.3] text-ink no-underline hover:text-gold hover:underline"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

/** Bande « Les sujets du moment » : les sujets les plus traités de la semaine. */
function TrendingBar({ tags }: { tags: Array<{ slug: string; name: string }> }) {
  if (tags.length < 3) return null;
  return (
    <nav aria-label="Les sujets du moment" className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span className="font-display shrink-0 text-[0.8rem] tracking-[0.14em] text-gold">
        Les sujets du moment
      </span>
      <ul className="no-scrollbar flex w-full min-w-0 flex-1 list-none gap-2 overflow-x-auto p-0 [mask-image:linear-gradient(90deg,#000_88%,transparent)]">
        {tags.map((t) => (
          <li key={t.slug} className="shrink-0">
            <Link
              href={tagPath(t.slug)}
              className="inline-flex items-center rounded-lg border border-rule bg-card/60 px-3 py-1 text-[0.88rem] text-ink no-underline transition hover:border-accent hover:text-gold hover:no-underline"
            >
              {t.name.charAt(0).toUpperCase() + t.name.slice(1)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SmallCard({ item }: { item: Item }) {
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
      </div>
    </article>
  );
}

function LiveColumn({ items, mostRead }: { items: Item[]; mostRead: Item[] }) {
  return (
    <aside aria-labelledby="en-continu" className="lg:self-start">
      <div className="flex items-center gap-2 border-b-2 border-accent pb-2">
        <span className="live-dot" aria-hidden />
        <h2 id="en-continu" className="font-display text-[1.05rem] tracking-[0.1em]">
          En continu
        </h2>
      </div>
      <ol className="divide-y divide-rule">
        {items.map((item) => (
<li key={item.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 py-3">
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

      {mostRead.length >= 3 ? (
        <section aria-labelledby="plus-lus" className="mt-10">
          <h2 id="plus-lus" className="font-display border-b-2 border-accent pb-2 text-[1.05rem] tracking-[0.1em]">
            Les plus lus
          </h2>
          <ol className="divide-y divide-rule">
            {mostRead.map((item, i) => (
              <li key={item.id} className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-2 py-3">
                <span className="font-headline text-[1.6rem] leading-none text-accent">{i + 1}</span>
                <Link
                  href={articlePublicPath(item.publicId)}
                  className="font-headline text-[1rem] leading-[1.28] text-ink no-underline hover:text-gold hover:no-underline"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </aside>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-t-[3px] border-ink pt-3">
      <h2 className="font-display flex items-center gap-2.5 text-[1.55rem] leading-none tracking-[0.08em]">
        <span aria-hidden className="inline-block h-[0.7em] w-[0.7em] rounded-[2px] bg-accent" />
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

/** Rubrique : un article en avant (image, titre, chapô), puis des titres seuls avec vignette. */
function SectionFeature({ items }: { items: Item[] }) {
  const [lead, ...rest] = items;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
      <article className="group">
        <Media item={lead} sizes="(min-width: 1024px) 36rem, 100vw" />
        <h3 className="font-headline mt-3 text-[1.35rem] leading-[1.2] sm:text-[1.5rem]">
          <Link href={articlePublicPath(lead.publicId)} className="no-underline hover:text-gold hover:no-underline">
            {lead.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-[0.98rem] leading-snug text-muted">{lead.excerpt}</p>
      </article>
      <ul className="divide-y divide-rule border-t border-rule lg:border-t-0">
        {rest.map((item) => (
          <li key={item.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 py-3 first:lg:pt-0 lg:grid-cols-[7rem_minmax(0,1fr)] lg:gap-4">
            <Media item={item} sizes="8rem" ratio="aspect-[4/3]" />
            <div className="min-w-0">
              <h3 className="font-headline text-[1rem] leading-[1.28]">
                <Link href={articlePublicPath(item.publicId)} className="no-underline hover:text-gold hover:no-underline">
                  {item.title}
                </Link>
              </h3>
              <p className="mt-1 hidden text-[0.88rem] leading-snug text-muted lg:line-clamp-2">{item.excerpt}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rubrique en simple liste de titres : casse la répétition des blocs illustrés. */
function SectionList({ items }: { items: Item[] }) {
  return (
    <ul className="grid gap-x-10 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="border-b border-rule py-3">
          <span className="text-[0.78rem] font-semibold tabular-nums text-gold">{liveStamp(item.publishedAt)}</span>
          <h3 className="font-headline mt-0.5 text-[1.05rem] leading-[1.28]">
            <Link href={articlePublicPath(item.publicId)} className="no-underline hover:text-gold hover:no-underline">
              {item.title}
            </Link>
          </h3>
        </li>
      ))}
    </ul>
  );
}

/** Rubriques présentées en liste de titres plutôt qu'en bloc illustré. */
const LIST_SECTIONS = new Set<ArticleCategory>(["insolite"]);

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
  const secondary = latest.slice(1, 1 + SECONDARY_COUNT);
  // Les blocs rubriques ne reprennent rien de ce qui est déjà en haut de page.
  const shown = new Set(latest.map((a) => a.id));

  // Sujets du moment et articles liés à la une : une panne n'empêche pas l'accueil.
  const [trending, leadRelated] = await Promise.all([
    withDbTimeout(trendingTags(7, 10)).catch(() => []),
    lead
      ? withDbTimeout(relatedByTags(lead.id, latest.slice(1).map((a) => a.id), 3)).catch(() => [])
      : Promise.resolve([]),
  ]);

  // « Les plus lus » : 48 dernières heures. Une panne du compteur ne casse pas l'accueil.
  let mostRead: Item[] = [];
  try {
    const ids = await withDbTimeout(mostReadPublicIds(2, 5));
    if (ids.length) {
      const rows: Item[] = await withDbTimeout(
        prisma.article.findMany({
          where: { ...publishedArticleWhere({}), publicId: { in: ids } },
          select,
        }),
      );
      mostRead = ids.map((id) => rows.find((r) => r.publicId === id)).filter((r): r is Item => Boolean(r));
    }
  } catch (err) {
    console.error("plus lus", err);
  }

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
      <h1 className="sr-only">Le Rempart, le média de droite assumé : l&apos;actualité à la une</h1>
      <p className="font-display mb-6 flex items-center gap-3 border-b border-rule pb-3 text-[0.9rem] tracking-[0.1em] sm:text-[0.95rem]">
        <time dateTime={new Date().toISOString().slice(0, 10)} className="text-ink">
          {todayLabel()}
        </time>
        <span aria-hidden className="h-3.5 w-px bg-accent/60" />
        <span className="text-gold">Édition du jour</span>
      </p>
      <AdSlot slot="home-below-header" />
      <TrendingBar tags={trending} />

      {!lead ? (
        <p className="py-16 text-center text-muted">Aucun article publié pour le moment.</p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
          <div className="min-w-0">
            <Lead item={lead} related={leadRelated} />
            {secondary.length ? (
              <div className="mt-8 grid gap-x-6 gap-y-8 border-t border-rule pt-7 sm:grid-cols-3">
                {secondary.map((item) => (
                  <SmallCard key={item.id} item={item} />
                ))}
              </div>
            ) : null}
          </div>
          <LiveColumn
            items={latest.slice(
              1 + SECONDARY_COUNT,
              1 + SECONDARY_COUNT + LIVE_COUNT + (leadRelated.length >= 2 ? LIVE_EXTRA_WITH_RELATED : 0),
            )}
            mostRead={mostRead}
          />
        </div>
      )}

      <form action="/" method="get" role="search" className="mt-12 flex items-center gap-2 border-y border-rule py-4">
        <label htmlFor="home-search" className="sr-only">
          Rechercher dans les articles
        </label>
        <input
          id="home-search"
          name="q"
          type="search"
          placeholder="Rechercher un article…"
          className="min-w-0 flex-1 border border-rule bg-transparent px-3 py-2 text-[0.98rem]"
        />
        <button
          type="submit"
          aria-label="Lancer la recherche"
          title="Rechercher"
          className="group h-11 w-11 inline-flex shrink-0 items-center justify-center rounded-lg border border-accent/60 bg-ink text-accent btn-ink transition duration-300 hover:border-accent hover:text-gold"
        >
          <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
      </form>

      {sections
        .filter((s) => s.items.length > 0)
        .map(({ category, items }) => (
          <section key={category} className="mt-12" aria-label={CATEGORY_META[category].label}>
            <SectionHead title={CATEGORY_META[category].label} href={categoryPath(category)} />
            {LIST_SECTIONS.has(category) ? <SectionList items={items.slice(0, 4)} /> : <SectionFeature items={items} />}
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
