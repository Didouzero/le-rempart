import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SITE_AUTHOR } from "@/lib/authors";
import {
  ABOUT_PATH,
  CHARTER_PATH,
  ORGANIZATION_ID,
  absoluteUrl,
  breadcrumbJsonLd,
  buildPageMetadata,
} from "@/lib/seo";

const DESCRIPTION =
  "La charte éditoriale du Rempart : d'où viennent nos informations, comment nous les vérifions, comment nous distinguons les faits de l'opinion, et comment nous corrigeons nos erreurs.";

export const metadata: Metadata = buildPageMetadata({
  title: "Charte éditoriale",
  description: DESCRIPTION,
  path: CHARTER_PATH,
});

type Section = { id: string; title: string; paragraphs: string[] };

const SECTIONS: Section[] = [
  {
    id: "responsabilite",
    title: "Qui répond de ce qui est publié",
    paragraphs: [
      `Le Rempart est dirigé par ${SITE_AUTHOR.name}, fondateur et rédacteur en chef. Il choisit les sujets, fixe l'angle de chaque article et répond de tout ce qui paraît sur le site, sur nos réseaux et dans nos newsletters.`,
      "Le Rempart est un média d'opinion ancré à droite. Nous l'affichons plutôt que de feindre une neutralité que personne ne pratique. Afficher une ligne n'autorise pas à arranger les faits : c'est précisément parce que nous défendons des idées que nos informations doivent être irréprochables.",
    ],
  },
  {
    id: "sources",
    title: "D'où viennent nos informations",
    paragraphs: [
      "Nos articles partent de sources identifiables : documents officiels (rapports de la Cour des comptes, de l'Insee, des ministères, lois de finances, délibérations des collectivités), décisions de justice, déclarations publiques, dépêches et articles de presse.",
      "Quand une information vient d'un autre média, nous le nommons et, sur le site, nous renvoyons vers l'article d'origine. Quand elle vient d'un document public, nous renvoyons vers le document lui-même, pour que chacun puisse vérifier.",
    ],
  },
  {
    id: "verification",
    title: "Comment nous vérifions",
    paragraphs: [
      "Une information n'est publiée que si elle repose sur au moins une source sérieuse et nommée. Les chiffres sont repris tels que la source les donne, avec leur date et leur périmètre. Les citations sont reproduites entre guillemets, mot pour mot, et attribuées à leur auteur.",
      "Une information qui n'est pas confirmée est présentée comme telle. Nous n'inventons ni chiffre, ni citation, ni témoin, et nous ne prêtons à personne des propos qu'il n'a pas tenus.",
    ],
  },
  {
    id: "faits-et-opinion",
    title: "Les faits et l'opinion",
    paragraphs: [
      "Nos articles d'actualité rapportent des faits. Le ton, le choix des sujets et le regard porté sur eux relèvent de notre ligne, et nous l'assumons. Le lecteur doit toujours pouvoir distinguer ce qui est établi de ce qui est un jugement.",
      "Une personne mise en cause dans une procédure est présumée innocente tant qu'elle n'a pas été définitivement condamnée. Nous écrivons « mis en examen », « poursuivi » ou « condamné » selon l'état réel de la procédure.",
    ],
  },
  {
    id: "ia",
    title: "L'intelligence artificielle, un outil",
    paragraphs: [
      "La recherche et la rédaction s'appuient sur l'intelligence artificielle, à partir des sujets et des angles choisis par la rédaction. L'IA sert à rassembler les sources, à les lire et à rédiger ; elle ne choisit ni les sujets, ni la ligne.",
      "La rédaction garde l'entière responsabilité de chaque texte publié, comme si elle l'avait écrit seule.",
    ],
  },
  {
    id: "illustrations",
    title: "Les illustrations",
    paragraphs: [
      "Une image d'archive ou d'illustration n'est jamais présentée comme une photo de l'événement raconté. Quand une légende accompagne l'image, elle dit ce qu'elle montre et d'où elle vient.",
    ],
  },
  {
    id: "enquetes",
    title: "Les enquêtes Rempart+",
    paragraphs: [
      "Les enquêtes publiées le mercredi et le samedi pour les abonnés Rempart+ suivent les mêmes règles, avec plus de documents : budgets, subventions, marchés publics, déclarations de patrimoine, votes. Chaque enquête nomme les décideurs et renvoie aux pièces sur lesquelles elle s'appuie.",
    ],
  },
  {
    id: "corrections",
    title: "Nos corrections",
    paragraphs: [
      "Une erreur factuelle avérée est corrigée dans les meilleurs délais, directement dans l'article. Une correction qui change le sens d'une information est signalée au lecteur dans le texte.",
      "Pour nous signaler une erreur, écrivez à contact@le-rempart.org en indiquant l'adresse de l'article et ce qui vous paraît inexact, avec une source si vous en avez une. Chaque signalement est lu.",
    ],
  },
  {
    id: "droit-de-reponse",
    title: "Le droit de réponse",
    paragraphs: [
      "Toute personne nommée ou désignée dans un article peut exercer son droit de réponse, dans les conditions prévues par l'article 6 de la loi pour la confiance dans l'économie numérique. La demande s'adresse à contact@le-rempart.org.",
    ],
  },
  {
    id: "independance",
    title: "Indépendance et financement",
    paragraphs: [
      "Aucun parti, aucun groupe de presse, aucun actionnaire ne décide de ce que nous publions. Le Rempart vit de la publicité et de l'abonnement Rempart+. Les contenus sponsorisés qui apparaissent sous certains articles sont signalés comme tels et ne sont jamais mêlés à nos articles.",
    ],
  },
];

export default function CharteEditorialePage() {
  return (
    <div className="animate-fade-up">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          url: absoluteUrl(CHARTER_PATH),
          name: "Charte éditoriale du Rempart",
          description: DESCRIPTION,
          inLanguage: "fr-FR",
          about: { "@id": ORGANIZATION_ID },
          publisher: { "@id": ORGANIZATION_ID },
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Qui sommes-nous", path: ABOUT_PATH },
          { name: "Charte éditoriale", path: CHARTER_PATH },
        ])}
      />

      <header className="border-b-4 border-ink pb-10">
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          Charte éditoriale
        </p>
        <h1 className="font-headline mt-4 max-w-4xl text-4xl leading-[1.08] sm:text-5xl">
          Une ligne assumée, <span className="text-gold">des faits vérifiables.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">{DESCRIPTION}</p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Sommaire de la charte" className="hidden lg:block">
          <ol className="sticky top-24 list-none space-y-2 p-0 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-muted no-underline hover:text-gold hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="max-w-3xl space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="font-headline text-3xl">
                {section.title}
                <span className="text-accent">.</span>
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="mt-3 leading-relaxed text-ink">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <p className="border-t border-ink/15 pt-6 text-sm text-muted">
            Nous écrire :{" "}
            <a href="mailto:contact@le-rempart.org" className="underline decoration-accent">
              contact@le-rempart.org
            </a>{" "}
            ·{" "}
            <Link href={ABOUT_PATH} className="underline decoration-accent">
              Qui sommes-nous
            </Link>{" "}
            ·{" "}
            <Link href={SITE_AUTHOR.path} className="underline decoration-accent">
              {SITE_AUTHOR.name}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
