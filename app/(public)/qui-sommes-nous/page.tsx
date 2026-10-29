import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SITE_AUTHOR } from "@/lib/authors";
import { CATEGORY_META, ARTICLE_CATEGORIES } from "@/lib/categories";
import {
  ABOUT_PATH,
  ORGANIZATION_ID,
  absoluteUrl,
  buildPageMetadata,
} from "@/lib/seo";

const DESCRIPTION =
  "Le Rempart, média d'actualité indépendant ancré à droite : qui le dirige, sa ligne éditoriale, sa méthode de travail, sa politique de correction et son financement.";

export const metadata: Metadata = buildPageMetadata({
  title: "Qui sommes-nous",
  description: DESCRIPTION,
  path: ABOUT_PATH,
});

const PILLARS = [
  ["Indépendant", "Aucun parti, aucun groupe de presse, aucun actionnaire ne décide de ce que nous publions."],
  ["Assumé", "Nous sommes un média d'opinion de droite, et nous l'affichons plutôt que de feindre la neutralité."],
  ["Sourcé", "Afficher une ligne n'autorise pas à arranger les faits. Chaque information s'appuie sur une source citée."],
] as const;

const METHOD = [
  ["Les faits d'abord", "Dépêches et articles de presse, décisions de justice, documents officiels, déclarations publiques. Les citations sont reproduites entre guillemets et attribuées."],
  ["L'IA comme outil", "La recherche et la rédaction s'appuient sur l'intelligence artificielle, à partir des sujets et des angles choisis par la rédaction, qui en garde la responsabilité."],
  ["Le doute signalé", "Une information non confirmée est présentée comme telle. Nous n'inventons ni chiffre, ni citation, ni témoin."],
] as const;

export default function QuiSommesNousPage() {
  return (
    <div className="animate-fade-up">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          url: absoluteUrl(ABOUT_PATH),
          name: "Qui sommes-nous",
          description: DESCRIPTION,
          inLanguage: "fr-FR",
          about: { "@id": ORGANIZATION_ID },
        }}
      />

      {/* Ouverture façon manifeste : du texte, pas d'image. */}
      <header className="border-b-4 border-ink pb-10">
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          Qui sommes-nous
        </p>
        <h1 className="font-display mt-4 max-w-4xl text-4xl leading-[0.95] tracking-[0.02em] uppercase sm:text-5xl lg:text-6xl">
          Raconter jusqu&apos;au bout ce que{" "}
          <span className="text-gold">les autres taisent.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Le Rempart est un média d&apos;actualité indépendant, ancré à droite,
          fondé en 2025 et dirigé par{" "}
          <Link href={SITE_AUTHOR.path} className="text-ink underline decoration-accent">
            {SITE_AUTHOR.name}
          </Link>
          , qui choisit les sujets, fixe l&apos;angle de chaque article et
          répond de tout ce qui est publié.
        </p>
      </header>

      {/* Trois engagements en colonnes séparées par des filets. */}
      <section className="grid divide-y divide-ink/15 border-b border-ink/15 md:grid-cols-3 md:divide-x md:divide-y-0">
        {PILLARS.map(([title, text]) => (
          <div key={title} className="py-8 md:px-8 md:first:pl-0 md:last:pr-0">
            <h2 className="font-display text-3xl tracking-[0.06em] uppercase">
              {title}
              <span className="text-accent">.</span>
            </h2>
            <p className="mt-3 text-muted">{text}</p>
          </div>
        ))}
      </section>

      <section className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <h2 className="font-display text-4xl tracking-[0.05em]">Notre ligne</h2>
          <p className="mt-4 text-ink">
            Nous sommes attachés à l&apos;ordre et à l&apos;autorité de
            l&apos;État, à la fermeté face à l&apos;immigration illégale et à la
            délinquance, à la souveraineté nationale, à l&apos;identité et à
            l&apos;héritage français, à la valeur du travail et au bon usage de
            l&apos;argent des contribuables.
          </p>
          <p className="mt-6 text-sm text-muted">Nos rubriques</p>
          <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
            {ARTICLE_CATEGORIES.map((key) => (
              <li key={key}>
                <Link
                  href={`/rubriques/${CATEGORY_META[key].slug}`}
                  className="font-display inline-block rounded-full border border-ink px-4 py-1.5 text-sm tracking-[0.12em] text-ink no-underline transition hover:bg-ink hover:text-gold hover:no-underline"
                >
                  {CATEGORY_META[key].label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/rubriques/enquetes"
                className="font-display inline-block rounded-full border border-accent bg-accent px-4 py-1.5 text-sm tracking-[0.12em] text-ink no-underline transition hover:bg-accent-deep hover:no-underline"
              >
                Enquêtes Rempart+
              </Link>
            </li>
          </ul>
        </div>

        {/* La méthode en étapes, chiffres géants en filigrane. */}
        <div>
          <h2 className="font-display text-4xl tracking-[0.05em]">Notre méthode</h2>
          <ol className="mt-4 list-none space-y-4 p-0">
            {METHOD.map(([title, text], i) => (
              <li
                key={title}
                className="relative overflow-hidden rounded-lg border-l-4 border-accent bg-card/55 p-5 pl-6"
              >
                <span
                  aria-hidden
                  className="font-display pointer-events-none absolute -top-3 right-3 text-8xl leading-none text-ink/[0.06]"
                >
                  {i + 1}
                </span>
                <h3 className="font-display text-xl tracking-[0.06em]">{title}</h3>
                <p className="mt-1 text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Engagements pratiques, en bandeau sombre. */}
      <section
        data-theme="light"
        className="night-grid mt-14 grid gap-px overflow-hidden rounded-lg border border-transparent bg-white/15 text-paper md:grid-cols-3"
      >
        {[
          ["Une erreur ?", "Écrivez-nous en indiquant l'adresse de l'article : les erreurs factuelles avérées sont corrigées dans les meilleurs délais."],
          ["Mis en cause ?", "Toute personne nommée ou désignée dans un article peut exercer son droit de réponse, dans les conditions prévues par la loi."],
          ["Qui nous finance ?", "La publicité et l'abonnement Rempart+. Rien d'autre."],
        ].map(([title, text]) => (
          <div key={title} className="bg-ink p-6">
            <h3 className="font-display text-2xl tracking-[0.06em] text-accent">{title}</h3>
            <p className="mt-2 text-white/75">{text}</p>
          </div>
        ))}
      </section>

      <p className="mt-8 text-sm text-muted">
        Nous écrire :{" "}
        <a href="mailto:contact@le-rempart.org" className="underline decoration-accent">
          contact@le-rempart.org
        </a>{" "}
        ·{" "}
        <Link href="/s-abonner" className="underline decoration-accent">
          Rempart+
        </Link>{" "}
        ·{" "}
        <Link href="/mentions-legales" className="underline decoration-accent">
          Mentions légales
        </Link>
      </p>
    </div>
  );
}
