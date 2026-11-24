/** Page auteur : présentation de Dimitri Scudo, puis la liste paginée de ses articles. */
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { Pagination } from "@/components/Pagination";
import { SITE_AUTHOR } from "@/lib/authors";
import { publishedArticleWhere } from "@/lib/article-list";
import { prisma, withDbTimeout } from "@/lib/prisma";
import {
  ABOUT_PATH,
  absoluteUrl,
  authorPersonJsonLd,
  buildPageMetadata,
} from "@/lib/seo";

const DESCRIPTION = `${SITE_AUTHOR.name}, fondateur et rédacteur en chef du Rempart : pourquoi j'ai lancé ce média, comment j'écris, et la ligne que je défends.`;

/** Articles par page dans « Ses articles ». */
const AUTHOR_PAGE_SIZE = 12;

/** Page 1 indexée ; les suivantes sont explorées (liens vers les articles) mais pas indexées. */
export function authorMetadata(page: number): Metadata {
  if (page <= 1) {
    return buildPageMetadata({
      title: SITE_AUTHOR.name,
      description: DESCRIPTION,
      path: SITE_AUTHOR.path,
    });
  }
  return buildPageMetadata({
    title: `Les articles de ${SITE_AUTHOR.name} — page ${page}`,
    description: `Tous les articles signés ${SITE_AUTHOR.name} sur Le Rempart, du plus récent au plus ancien (page ${page}).`,
    path: `${SITE_AUTHOR.path}?page=${page}`,
    noIndex: true,
  });
}

type AuthorArticle = {
  id: string;
  publicId: number;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
  category: string;
  coverImageUrl: string | null;
};

const FACTS = [
  ["Rôle", "Fondateur, rédacteur en chef"],
  ["Depuis", "2025"],
  ["Statut", "Média indépendant"],
  ["Méthode", "Assistée par l'IA"],
  ["Ligne", "Droite, assumée"],
] as const;

const TIMELINE = [
  {
    when: "2025",
    title: "Quatre, autour d'une table",
    text: "Au départ, nous étions trois amis politiquement marqués à droite et moi. Nous avions un constat commun : la droite stagne dans l'opinion publique. Il fallait accélérer le processus.",
  },
  {
    when: "Le pari",
    title: "Gagner le débat des idées",
    text: "Notre mission : raconter les faits, parfois avec une opinion clairement assumée, pour faire avancer nos idées et ne laisser aucune possibilité à la gauche de triompher dans le débat public.",
  },
  {
    when: "Aujourd'hui",
    title: "Je suis resté seul aux commandes",
    text: "Travailler bénévolement n'est pas chose facile au lancement d'un projet d'une telle ambition. Pour diverses raisons, je suis resté seul aux commandes depuis février 2026. Je m'appuie sur l'intelligence artificielle là où je m'appuyais hier sur une rédaction.",
  },
] as const;

const CONVICTIONS = [
  ["Un État qui tient", "La sécurité est la première des libertés. Je raconte sans détour ce que la délinquance et l'impunité coûtent aux Français."],
  ["Une France souveraine", "Maîtriser nos frontières, défendre notre héritage, décider chez nous de ce qui nous concerne."],
  ["L'argent des Français", "Chaque euro public sort de la poche de quelqu'un. Je traque les gaspillages et les privilèges."],
] as const;

export async function AuthorProfile({ requested }: { requested: number }) {
  const where = publishedArticleWhere({});
  const total = await withDbTimeout(prisma.article.count({ where }));
  const totalPages = Math.max(1, Math.ceil(total / AUTHOR_PAGE_SIZE));
  if (requested > totalPages) notFound();
  const page = requested;
  const articles: AuthorArticle[] = await withDbTimeout(
    prisma.article.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * AUTHOR_PAGE_SIZE,
      take: AUTHOR_PAGE_SIZE,
      select: {
        id: true,
        publicId: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        category: true,
        coverImageUrl: true,
      },
    }),
  );

  const list = (
    <section id="ses-articles" aria-labelledby="ses-articles-titre" className="mt-16 scroll-mt-24">
      <div className="mb-2 flex items-end justify-between gap-4 border-t-[3px] border-ink pt-3">
        <h2 id="ses-articles-titre" className="font-display flex items-center gap-2.5 text-[1.55rem] leading-none tracking-[0.08em]">
          <span aria-hidden className="inline-block h-[0.7em] w-[0.7em] rounded-[2px] bg-accent" />
          Ses articles
        </h2>
        <p className="font-display shrink-0 text-[0.8rem] tracking-[0.1em] text-muted">
          {total} articles{page > 1 ? ` · page ${page} sur ${totalPages}` : ""}
        </p>
      </div>
      {articles.map((article, index) => (
        <ArticleCard
          key={article.id}
          id={article.id}
          publicId={article.publicId}
          title={article.title}
          excerpt={article.excerpt}
          publishedAt={article.publishedAt}
          category={article.category}
          hasCover={Boolean(article.coverImageUrl)}
          coverUrl={article.coverImageUrl}
          index={index}
        />
      ))}
      <Pagination page={page} totalPages={totalPages} basePath={SITE_AUTHOR.path} />
    </section>
  );

  if (page > 1) {
    // Pages suivantes : un en-tête court, la présentation complète reste sur la page 1.
    return (
      <div>
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          L&apos;auteur
        </p>
        <h1 className="font-headline mt-2 text-4xl leading-[1.05] sm:text-5xl">
          <Link href={SITE_AUTHOR.path} className="no-underline hover:text-gold hover:no-underline">
            {SITE_AUTHOR.name}
          </Link>
        </h1>
        <p className="article-standfirst mt-3 text-muted">
          Tous ses articles, du plus récent au plus ancien.
        </p>
        {list}
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: absoluteUrl(SITE_AUTHOR.path),
          name: SITE_AUTHOR.name,
          inLanguage: "fr-FR",
          mainEntity: authorPersonJsonLd(),
        }}
      />

      <div className="grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14">
        {/* Fiche d'identité : fixe à côté du texte sur ordinateur, sous l'intro sur téléphone. */}
        <aside className="hidden lg:sticky lg:top-8 lg:block lg:self-start">
          <IdentityCard />
        </aside>

        <article className="min-w-0">
          <p className="section-kicker">
            <span className="live-dot" aria-hidden />
            L&apos;auteur
          </p>
          <h1 className="font-headline mt-2 text-5xl leading-[1.02] sm:text-7xl">
            {SITE_AUTHOR.name}
          </h1>
          <p className="article-standfirst mt-3 text-muted">
            {SITE_AUTHOR.jobTitle} du Rempart
          </p>

          <p className="mt-10 text-xl leading-relaxed text-ink first-letter:float-left first-letter:mt-[0.08em] first-letter:mr-[0.08em] first-letter:font-headline first-letter:text-[2.95em] first-letter:font-bold first-letter:leading-[0.8] first-letter:text-ink">
            J&apos;ai fondé Le Rempart en 2025 et j&apos;en suis le rédacteur en
            chef. Je l&apos;ai lancé parce que je refusais de laisser le récit
            de l&apos;actualité à un seul camp.
          </p>

          <div className="mt-10 lg:hidden">
            <IdentityCard />
          </div>

          {/* Frise : d'où vient le projet. */}
          <ol className="relative mt-12 list-none space-y-8 border-l-2 border-accent/60 p-0 pl-8">
            {TIMELINE.map((step) => (
              <li key={step.title} className="relative">
                <span
                  aria-hidden
                  className="absolute top-1.5 -left-[2.45rem] h-4 w-4 rounded-full border-2 border-accent bg-paper"
                />
                <p className="font-display text-xs tracking-[0.2em] text-gold uppercase">
                  {step.when}
                </p>
                <h2 className="font-headline mt-1 text-2xl">{step.title}</h2>
                <p className="mt-2 text-ink">{step.text}</p>
              </li>
            ))}
          </ol>

          <h2 className="font-headline mt-14 text-3xl">Comment j&apos;écris</h2>
          <div className="mt-4 space-y-4 text-ink">
            <p>
              Je m&apos;aide de l&apos;intelligence artificielle pour chercher,
              recouper et rédiger. Je le dis franchement, je n&apos;ai rien à
              cacher sur la méthode en soi.
            </p>
            <p>
              L&apos;IA n&apos;est en revanche pas aux commandes. Je choisis
              chaque sujet, je fixe la ligne éditoriale et j&apos;écris
              moi-même une bonne partie des articles. Les choix et les partis
              pris sont les miens, et j&apos;en réponds.
            </p>
            <p>
              Le Rempart n&apos;appartient à aucun groupe : ni actionnaire, ni
              carte de presse. Ma seule caution, c&apos;est la méthode, publiée
              dans la{" "}
              <Link href="/charte-editoriale" className="underline decoration-accent">
                charte éditoriale
              </Link>
              .
            </p>
          </div>

          <blockquote className="my-10 border-y-2 border-ink py-6">
            <p className="font-headline text-2xl leading-snug italic sm:text-3xl">
              « Un article du Rempart peut prendre parti.{" "}
              <span className="text-gold">Il ne doit jamais arranger les faits.</span> »
            </p>
          </blockquote>

          <h2 className="font-headline text-3xl">Ce que je défends</h2>
          <ul className="mt-6 list-none space-y-0 p-0">
            {CONVICTIONS.map(([title, text], i) => (
              <li key={title} className="grid grid-cols-[3.5rem_1fr] gap-4 border-t border-ink/15 py-5">
                <span className="font-headline text-4xl leading-none font-bold text-accent">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-headline text-xl font-semibold">{title}</h3>
                  <p className="mt-1 text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-muted">
            Une erreur, une remarque, un droit de réponse :{" "}
            <a href="mailto:contact@le-rempart.org" className="underline decoration-accent">
              contact@le-rempart.org
            </a>
            . Je lis tout, et je corrige quand j&apos;ai tort. La méthode du
            média est détaillée dans{" "}
            <Link href={ABOUT_PATH} className="underline decoration-accent">
              Qui sommes-nous
            </Link>
            .
          </p>
        </article>
      </div>

      {list}
    </div>
  );
}

function IdentityCard() {
  return (
    <>
      <div className="relative mx-auto w-48 lg:mx-0 lg:w-full">
        <div
          aria-hidden
          className="absolute -right-3 -bottom-3 h-full w-full rounded-lg border-2 border-accent"
        />
        {SITE_AUTHOR.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={SITE_AUTHOR.photo}
            alt={`Portrait de ${SITE_AUTHOR.name}`}
            className="relative aspect-[4/5] w-full rounded-lg object-cover grayscale-[35%]"
          />
        ) : (
          <div className="font-display relative flex aspect-[4/5] w-full items-center justify-center rounded-lg bg-ink text-7xl tracking-[0.08em] text-accent">
            DS
          </div>
        )}
      </div>

      <dl className="mt-8 divide-y divide-ink/15 border-y border-ink/15 text-sm">
        {FACTS.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="font-display text-xs tracking-[0.16em] text-muted uppercase">
              {label}
            </dt>
            <dd className="text-right text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <a
        href="mailto:contact@le-rempart.org"
        className="btn-ink font-display mt-6 block rounded-lg border border-accent/50 bg-ink px-4 py-3 text-center tracking-[0.14em] text-accent no-underline shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition hover:border-accent hover:bg-accent hover:text-ink hover:no-underline"
      >
        M&apos;écrire
      </a>
    </>
  );
}
