import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité et protection des données personnelles — Le Rempart.",
  path: "/confidentialite",
});


export default function ConfidentialitePage() {
  return (
    <article className="prose-article max-w-3xl animate-fade-up">
      <h1 className="font-display text-3xl sm:text-4xl">
        Politique de confidentialité
      </h1>
      <p className="mt-4 text-sm text-muted">
        La présente politique décrit comment Le Rempart collecte et utilise les
        données dans le cadre du Site{" "}
        <a href="https://www.le-rempart.org">www.le-rempart.org</a> et des outils
        associés (notamment publication sur les réseaux sociaux).
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est l&apos;éditeur du Site Le Rempart,
        joignable à{" "}
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a>.
      </p>

      <h2>2. Quelles données sont concernées ?</h2>
      <p>Selon les cas, nous pouvons traiter :</p>
      <ul>
        <li>
          des données de navigation techniques (adresse IP, type de navigateur,
          pages consultées), via l&apos;hébergeur ou des outils de mesure ;
        </li>
        <li>
          des données liées à la publicité (cookies / identifiants) si des
          services comme Google AdSense sont activés ;
        </li>
        <li>
          des données fournies volontairement (message e-mail de contact, droit
          de réponse) ;
        </li>
        <li>
          pour la rédaction interne uniquement : contenus et images transmis via
          nos outils de publication (par exemple Telegram), afin de publier des
          articles sur le Site et éventuellement sur notre Page Facebook.
        </li>
      </ul>
      <p>
        Nous ne vendons pas de données personnelles. Nous n&apos;utilisons pas
        les données de la plateforme Meta pour profiler le grand public ni pour
        fournir un service à des clients tiers : l&apos;usage Meta sert à gérer{" "}
        <strong>notre propre Page</strong>.
      </p>

      <h2>3. Finalités</h2>
      <ul>
        <li>mettre en ligne et faire fonctionner le Site ;</li>
        <li>publier des contenus d&apos;information ;</li>
        <li>
          assurer la sécurité, mesurer l&apos;audience et, le cas échéant,
          afficher de la publicité ;
        </li>
        <li>
          répondre aux demandes de contact et exercer les droits des personnes ;
        </li>
        <li>
          publier des contenus sur nos réseaux sociaux (Facebook) via nos outils
          internes.
        </li>
      </ul>

      <h2>4. Bases légales</h2>
      <p>Selon les traitements :</p>
      <ul>
        <li>intérêt légitime (fonctionnement du Site, sécurité, information) ;</li>
        <li>consentement (cookies non essentiels / publicité personnalisée) ;</li>
        <li>obligation légale le cas échéant.</li>
      </ul>

      <h2>5. Cookies et publicité</h2>
      <p>
        Le Site peut utiliser des cookies ou technologies similaires,
        notamment si Google AdSense ou des outils d&apos;audience sont actifs.
        Ces services peuvent collecter des données selon leurs propres
        politiques (ex. Google). Vous pouvez paramétrer votre navigateur pour
        limiter les cookies.
      </p>

      <h2>6. Destinataires et sous-traitants</h2>
      <p>Les données peuvent être traitées par :</p>
      <ul>
        <li>l&apos;hébergeur du Site (Vercel) ;</li>
        <li>le prestataire de base de données le cas échéant ;</li>
        <li>
          des prestataires techniques (e-mail, analytics, publicité) ;
        </li>
        <li>
          Meta Platforms, uniquement dans le cadre de la publication sur notre
          Page Facebook, selon les conditions Meta.
        </li>
      </ul>
      <p>
        Des transferts hors Union européenne peuvent avoir lieu (hébergeurs
        américains). Dans ce cas, des garanties appropriées sont recherchées
        (clauses contractuelles types, etc.).
      </p>

      <h2>7. Durées de conservation</h2>
      <p>
        Les données sont conservées le temps nécessaire aux finalités ci-dessus,
        puis supprimées ou anonymisées, sous réserve d&apos;obligations légales
        de conservation.
      </p>

      <h2>8. Vos droits (RGPD)</h2>
      <p>
        Vous disposez, dans les conditions prévues par la réglementation, des
        droits d&apos;accès, de rectification, d&apos;effacement,
        d&apos;opposition, de limitation et, le cas échéant, de portabilité.
        Pour les exercer :{" "}
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a>.
      </p>
      <p>
        Vous pouvez également introduire une réclamation auprès de la CNIL (
        <a href="https://www.cnil.fr" rel="noopener noreferrer" target="_blank">
          www.cnil.fr
        </a>
        ).
      </p>

      <h2>9. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures raisonnables pour protéger les
        données. Aucun système n&apos;étant parfaitement sûr, une absence totale
        de risque ne peut être garantie.
      </p>

      <h2>10. Mineurs</h2>
      <p>
        Le Site n&apos;est pas destiné à collecter sciemment des données de
        mineurs de moins de 15 ans.
      </p>

      <h2>11. Modifications</h2>
      <p>
        Cette politique peut être mise à jour. La date de mise à jour figure
        ci-dessous. Les{" "}
        <Link href="/mentions-legales">mentions légales</Link> et les{" "}
        <Link href="/cgu">conditions d&apos;utilisation</Link> complètent ce
        document.
      </p>

      <p className="mt-10 text-sm text-muted">
        Dernière mise à jour : 25 juillet 2026
      </p>
    </article>
  );
}
