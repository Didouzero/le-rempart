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

export default function QuiSommesNousPage() {
  return (
    <article className="prose-article max-w-3xl animate-fade-up">
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

      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Le Rempart
      </p>
      <h1 className="font-display mt-2 text-4xl tracking-[0.08em] sm:text-5xl">
        Qui sommes-nous
      </h1>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />

      <h2>Un média d&apos;actualité indépendant</h2>
      <p>
        Le Rempart est un média d&apos;information en ligne fondé en 2025. Il
        couvre l&apos;actualité française à travers{" "}
        {ARTICLE_CATEGORIES.length} rubriques :{" "}
        {ARTICLE_CATEGORIES.map((key, i) => (
          <span key={key}>
            <Link href={`/rubriques/${CATEGORY_META[key].slug}`}>
              {CATEGORY_META[key].label.toLowerCase()}
            </Link>
            {i < ARTICLE_CATEGORIES.length - 2
              ? ", "
              : i === ARTICLE_CATEGORIES.length - 2
                ? " et "
                : ""}
          </span>
        ))}
        , complétées par des <Link href="/rubriques/enquetes">enquêtes</Link>{" "}
        de fond réservées aux abonnés Rempart+.
      </p>
      <p>
        Le Rempart ne dépend d&apos;aucun parti politique, d&apos;aucun groupe de
        presse et d&apos;aucun actionnaire.
      </p>

      <h2>Qui le dirige</h2>
      <p>
        Le Rempart est dirigé par{" "}
        <Link href={SITE_AUTHOR.path}>{SITE_AUTHOR.name}</Link>, son fondateur
        et rédacteur en chef. Il choisit les sujets, fixe l&apos;angle de chaque
        article et répond de l&apos;ensemble des contenus publiés.
      </p>

      <h2>Notre ligne éditoriale</h2>
      <p>
        Le Rempart est un média d&apos;opinion de droite, et l&apos;assume. Nous
        sommes attachés à l&apos;ordre et à l&apos;autorité de l&apos;État, à la
        fermeté face à l&apos;immigration illégale et à la délinquance, à la
        souveraineté nationale, à l&apos;identité et à l&apos;héritage français,
        à la valeur du travail et au bon usage de l&apos;argent des
        contribuables.
      </p>
      <p>
        Afficher une ligne n&apos;autorise pas à arranger les faits. Notre
        engagement porte sur le choix des sujets et sur l&apos;analyse, jamais
        sur l&apos;exactitude de ce que nous rapportons.
      </p>

      <h2>Notre méthode</h2>
      <ul>
        <li>
          <strong>Des faits sourcés.</strong> Nos articles s&apos;appuient sur des
          sources vérifiables : dépêches et articles de presse, décisions de
          justice, documents officiels, déclarations publiques. Les citations
          sont reproduites entre guillemets et attribuées à leur auteur.
        </li>
        <li>
          <strong>Une rédaction assistée par l&apos;intelligence
          artificielle.</strong> La recherche documentaire et la rédaction des
          articles sont réalisées avec l&apos;aide d&apos;outils d&apos;IA, à
          partir des sujets et des angles choisis par la rédaction. Chaque
          article est publié sous la responsabilité de son rédacteur en chef.
        </li>
        <li>
          <strong>Ce qui n&apos;est pas établi est signalé.</strong> Une
          information non confirmée est présentée comme telle (« selon… »,
          « d&apos;après… »). Nous n&apos;inventons ni chiffre, ni citation, ni
          témoin.
        </li>
      </ul>

      <h2>Corrections et droit de réponse</h2>
      <p>
        Une erreur dans un article ? Écrivez-nous à{" "}
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a> en
        indiquant l&apos;adresse de l&apos;article. Les erreurs factuelles
        avérées sont corrigées dans les meilleurs délais.
      </p>
      <p>
        Toute personne nommée ou désignée dans un article peut exercer son droit
        de réponse à la même adresse, dans les conditions prévues par la loi.
      </p>

      <h2>Notre financement</h2>
      <p>
        Le Rempart repose sur trois sources : la publicité affichée sur le site,
        l&apos;abonnement <Link href="/s-abonner">Rempart+</Link> (enquêtes
        exclusives et lecture sans publicité) et les{" "}
        <Link href="/nous-soutenir">dons</Link> de ses lecteurs.
      </p>

      <h2>Nous contacter</h2>
      <p>
        Pour toute demande, écrivez à{" "}
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a>. Les
        informations légales sont détaillées dans les{" "}
        <Link href="/mentions-legales">mentions légales</Link>.
      </p>
    </article>
  );
}
