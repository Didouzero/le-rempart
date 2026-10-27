import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { InfoCard, PageHero, SectionTitle } from "@/components/PageHero";
import { RelatedArticles, type RelatedArticleItem } from "@/components/RelatedArticles";
import { SITE_AUTHOR } from "@/lib/authors";
import { prisma, withDbTimeout } from "@/lib/prisma";
import {
  ABOUT_PATH,
  absoluteUrl,
  authorPersonJsonLd,
  buildPageMetadata,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

const DESCRIPTION = `${SITE_AUTHOR.name}, fondateur et rédacteur en chef du Rempart : pourquoi j'ai lancé ce média, comment j'écris, et la ligne que je défends.`;

export const metadata: Metadata = buildPageMetadata({
  title: SITE_AUTHOR.name,
  description: DESCRIPTION,
  path: SITE_AUTHOR.path,
});

const CONVICTIONS = [
  {
    kicker: "L'ordre",
    title: "Un État qui tient",
    text: "La sécurité est la première des libertés. Je raconte sans détour ce que la délinquance et l'impunité coûtent aux Français.",
  },
  {
    kicker: "La nation",
    title: "Une France souveraine",
    text: "Maîtriser nos frontières, défendre notre héritage et décider chez nous de ce qui nous concerne : rien de tout cela n'est négociable.",
  },
  {
    kicker: "Le travail",
    title: "L'argent des Français",
    text: "Chaque euro public sort de la poche de quelqu'un. Je traque les gaspillages, les privilèges et les promesses qu'on ne finance pas.",
  },
] as const;

export default async function AuthorPage() {
  let latest: RelatedArticleItem[] = [];
  try {
    latest = await withDbTimeout(
      prisma.article.findMany({
        where: { status: "published" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: { publicId: true, title: true, excerpt: true, coverImageUrl: true },
      }),
    );
  } catch {
    latest = [];
  }

  const portrait = SITE_AUTHOR.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SITE_AUTHOR.photo}
      alt={`Portrait de ${SITE_AUTHOR.name}`}
      className="h-40 w-40 rounded-full border-2 border-accent object-cover shadow-[var(--shadow-soft)] sm:h-52 sm:w-52"
    />
  ) : (
    <div
      aria-hidden
      className="font-display flex h-40 w-40 items-center justify-center rounded-full border-2 border-accent bg-black/40 text-5xl tracking-[0.1em] text-accent sm:h-52 sm:w-52 sm:text-6xl"
    >
      DS
    </div>
  );

  return (
    <div className="animate-fade-up">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: absoluteUrl(SITE_AUTHOR.path),
          name: SITE_AUTHOR.name,
          inLanguage: "fr-FR",
          mainEntity: {
            ...authorPersonJsonLd(),
            description: DESCRIPTION,
            ...(SITE_AUTHOR.photo ? { image: absoluteUrl(SITE_AUTHOR.photo) } : {}),
          },
        }}
      />

      <PageHero
        kicker={SITE_AUTHOR.jobTitle}
        title={SITE_AUTHOR.name}
        lead="Je ne suis pas journaliste et je ne prétends pas l'être : je n'ai pas de carte de presse. J'ai fondé Le Rempart parce que je refusais de laisser le récit de l'actualité à un seul camp."
        image="/rempart-plus-hero.jpg"
        aside={portrait}
      />

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <SectionTitle kicker="L'origine" title="Pourquoi Le Rempart" />
          <div className="mt-6 space-y-4 text-ink">
            <p>
              Le Rempart est né en 2025, d&apos;une conversation entre quatre
              personnes : trois journalistes et moi. Nous partagions le même
              constat. La droite progresse dans les urnes, mais elle perd presque
              toujours la bataille du récit. Les mêmes faits, racontés
              ailleurs, deviennent des « faits divers », des « polémiques », ou
              disparaissent tout simplement.
            </p>
            <p>
              Nous avons voulu un média qui les raconte jusqu&apos;au bout, qui
              fasse avancer les idées de droite et qui ne laisse aucun terrain à
              la gauche dans la bataille des idées.
            </p>
            <p>
              Avec le temps, nos chemins se sont séparés. J&apos;ai choisi de
              continuer seul, et de m&apos;appuyer sur l&apos;intelligence
              artificielle là où je m&apos;appuyais hier sur une rédaction.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-ink bg-ink p-6 text-paper sm:p-8">
          <p className="font-display text-[1.05rem] tracking-[0.18em] text-accent">
            Comment j&apos;écris
          </p>
          <div className="mt-4 space-y-4 text-white/80">
            <p>
              Je m&apos;aide de l&apos;intelligence artificielle pour chercher,
              recouper et rédiger. Je le dis franchement : je n&apos;ai rien à
              cacher sur ma méthode.
            </p>
            <p>
              Mais l&apos;IA n&apos;est pas aux commandes. Je choisis chaque
              sujet, je fixe chaque angle et j&apos;écris moi-même une partie
              des articles.
            </p>
            <p>
              La ligne éditoriale, ses choix et ses partis pris sont les miens,
              et j&apos;en réponds. Un article du Rempart peut prendre parti ; il
              ne doit jamais arranger les faits.
            </p>
          </div>
          <p className="mt-6 text-sm text-white/60">
            La méthode complète est décrite dans la page{" "}
            <Link href={ABOUT_PATH} className="text-accent underline decoration-accent">
              Qui sommes-nous
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mt-14">
        <SectionTitle kicker="Mes convictions" title="Ce que je défends" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {CONVICTIONS.map((c, i) => (
            <InfoCard key={c.title} index={i + 1} kicker={c.kicker} title={c.title}>
              <p>{c.text}</p>
            </InfoCard>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-lg border border-accent/50 bg-accent/15 px-5 py-6 sm:px-8">
        <p className="font-display text-xl tracking-[0.08em]">M&apos;écrire</p>
        <p className="mt-2 text-ink">
          Une remarque, une erreur à signaler, un droit de réponse à exercer :{" "}
          <a href="mailto:contact@le-rempart.org" className="underline decoration-accent">
            contact@le-rempart.org
          </a>
          . Je lis tout, et je corrige quand j&apos;ai tort.
        </p>
      </section>

      <RelatedArticles
        articles={latest}
        kicker="À la une"
        title="Voir les dernières actualités"
      />
      <p className="mt-6">
        <Link href="/" className="font-display tracking-[0.1em] text-ink underline decoration-accent underline-offset-4">
          Toutes les actualités →
        </Link>
      </p>
    </div>
  );
}
