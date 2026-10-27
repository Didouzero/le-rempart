import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { InfoCard, PageHero, SectionTitle } from "@/components/PageHero";
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
  {
    kicker: "Indépendant",
    title: "Aucun maître",
    text: "Le Rempart ne dépend d'aucun parti politique, d'aucun groupe de presse et d'aucun actionnaire.",
  },
  {
    kicker: "Assumé",
    title: "Une ligne de droite",
    text: "Nous sommes un média d'opinion, et nous l'affichons. Notre engagement porte sur le choix des sujets et l'analyse.",
  },
  {
    kicker: "Sourcé",
    title: "Des faits vérifiables",
    text: "Afficher une ligne n'autorise pas à arranger les faits. Chaque information s'appuie sur une source que nous citons.",
  },
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

      <PageHero
        kicker="Le Rempart"
        title="Qui sommes-nous"
        lead="Un média d'actualité indépendant, ancré à droite, fondé en 2025 pour raconter jusqu'au bout ce que les autres taisent ou minimisent."
        image="/rempart-plus-hero.jpg"
      />

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {PILLARS.map((p, i) => (
          <InfoCard key={p.title} index={i + 1} kicker={p.kicker} title={p.title}>
            <p>{p.text}</p>
          </InfoCard>
        ))}
      </section>

      <section className="mt-14 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <SectionTitle kicker="La rédaction" title="Qui le dirige" />
          <div className="mt-6 space-y-4 text-ink">
            <p>
              Le Rempart est dirigé par{" "}
              <Link href={SITE_AUTHOR.path} className="underline decoration-accent">
                {SITE_AUTHOR.name}
              </Link>
              , son fondateur et rédacteur en chef. Il choisit les sujets, fixe
              l&apos;angle de chaque article et répond de l&apos;ensemble des
              contenus publiés.
            </p>
            <p>
              Le Rempart couvre l&apos;actualité française à travers{" "}
              {ARTICLE_CATEGORIES.length} rubriques :{" "}
              {ARTICLE_CATEGORIES.map((key, i) => (
                <span key={key}>
                  <Link
                    href={`/rubriques/${CATEGORY_META[key].slug}`}
                    className="underline decoration-accent"
                  >
                    {CATEGORY_META[key].label.toLowerCase()}
                  </Link>
                  {i < ARTICLE_CATEGORIES.length - 2
                    ? ", "
                    : i === ARTICLE_CATEGORIES.length - 2
                      ? " et "
                      : ""}
                </span>
              ))}
              , complétées par des{" "}
              <Link href="/rubriques/enquetes" className="underline decoration-accent">
                enquêtes
              </Link>{" "}
              de fond réservées aux abonnés Rempart+.
            </p>
          </div>

          <div className="mt-10">
            <SectionTitle kicker="Nos valeurs" title="Notre ligne éditoriale" />
            <div className="mt-6 space-y-4 text-ink">
              <p>
                Nous sommes attachés à l&apos;ordre et à l&apos;autorité de
                l&apos;État, à la fermeté face à l&apos;immigration illégale et à
                la délinquance, à la souveraineté nationale, à l&apos;identité
                et à l&apos;héritage français, à la valeur du travail et au bon
                usage de l&apos;argent des contribuables.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-ink bg-ink p-6 text-paper sm:p-8">
          <p className="font-display text-[1.05rem] tracking-[0.18em] text-accent">
            Notre méthode
          </p>
          <ol className="mt-5 list-none space-y-5 p-0">
            <li className="flex gap-4">
              <span className="font-display text-accent">1</span>
              <p className="text-white/80">
                <strong className="text-paper">Des faits sourcés.</strong> Dépêches
                et articles de presse, décisions de justice, documents officiels,
                déclarations publiques. Les citations sont reproduites entre
                guillemets et attribuées.
              </p>
            </li>
            <li className="flex gap-4">
              <span className="font-display text-accent">2</span>
              <p className="text-white/80">
                <strong className="text-paper">Une rédaction assistée par l&apos;IA.</strong>{" "}
                La recherche et la rédaction s&apos;appuient sur des outils
                d&apos;intelligence artificielle, à partir des sujets et des
                angles choisis par la rédaction, qui en garde la responsabilité.
              </p>
            </li>
            <li className="flex gap-4">
              <span className="font-display text-accent">3</span>
              <p className="text-white/80">
                <strong className="text-paper">Ce qui n&apos;est pas établi est signalé.</strong>{" "}
                Une information non confirmée est présentée comme telle. Nous
                n&apos;inventons ni chiffre, ni citation, ni témoin.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        <InfoCard kicker="Exactitude" title="Corrections">
          <p>
            Une erreur dans un article ? Écrivez-nous en indiquant son adresse.
            Les erreurs factuelles avérées sont corrigées dans les meilleurs
            délais.
          </p>
        </InfoCard>
        <InfoCard kicker="Vos droits" title="Droit de réponse">
          <p>
            Toute personne nommée ou désignée dans un article peut exercer son
            droit de réponse, dans les conditions prévues par la loi.
          </p>
        </InfoCard>
        <InfoCard kicker="Modèle" title="Financement">
          <p>
            La publicité, l&apos;abonnement{" "}
            <Link href="/s-abonner" className="underline decoration-accent">
              Rempart+
            </Link>{" "}
            et les{" "}
            <Link href="/nous-soutenir" className="underline decoration-accent">
              dons
            </Link>{" "}
            de nos lecteurs.
          </p>
        </InfoCard>
      </section>

      <section className="mt-14 rounded-lg border border-accent/50 bg-accent/15 px-5 py-6 sm:px-8">
        <p className="font-display text-xl tracking-[0.08em]">Nous écrire</p>
        <p className="mt-2 text-ink">
          Pour toute demande :{" "}
          <a href="mailto:contact@le-rempart.org" className="underline decoration-accent">
            contact@le-rempart.org
          </a>
          . Les informations légales figurent dans les{" "}
          <Link href="/mentions-legales" className="underline decoration-accent">
            mentions légales
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
