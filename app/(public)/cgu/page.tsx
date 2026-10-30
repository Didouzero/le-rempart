import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Conditions générales d'utilisation",
  description:
    "Conditions générales d'utilisation du site Le Rempart (le-rempart.org).",
  path: "/cgu",
});


export default function CguPage() {
  return (
    <article className="prose-article max-w-3xl animate-fade-up">
      <h1 className="font-display text-3xl sm:text-4xl">
        Conditions générales d&apos;utilisation
      </h1>
      <p className="mt-4 text-sm text-muted">
        Les présentes conditions s&apos;appliquent à toute personne qui utilise
        le site Le Rempart.
      </p>

      <h2>1. Objet</h2>
      <p>
        Les présentes CGU encadrent l&apos;accès et l&apos;utilisation du Site
        d&apos;information Le Rempart, édité à l&apos;adresse{" "}
        <a href="https://www.le-rempart.org">www.le-rempart.org</a>.
      </p>

      <h2>2. Accès au Site</h2>
      <p>
        Le Site est accessible gratuitement (hors coûts de connexion), à
        l&apos;exception des contenus réservés aux abonnés Rempart+, régis par
        nos <Link href="/cgv">conditions générales de vente</Link>.
        L&apos;éditeur peut suspendre ou modifier le Site sans préavis pour
        maintenance, sécurité ou évolution éditoriale.
      </p>

      <h2>3. Contenus d&apos;information</h2>
      <p>
        Les articles, titres et illustrations ont un objet informatif ou
        d&apos;opinion. Ils ne constituent pas une invitation à la haine, à la
        violence ou à des actes illégaux. Les contenus satiriques sont présentés
        comme tels.
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        Les contenus du Site sont protégés par le droit d&apos;auteur, sauf
        mention contraire. Vous pouvez les citer brièvement en indiquant la
        source et en ajoutant un lien vers l&apos;article. Toute autre
        reproduction, y compris massive ou automatisée, nécessite notre accord
        écrit. Les contenus réservés aux abonnés ne peuvent pas être rediffusés.
      </p>

      <h2>5. Comportements interdits</h2>
      <p>Il est notamment interdit de :</p>
      <ul>
        <li>
          tenter de porter atteinte au Site (intrusion, surcharge, scraping
          abusif nuisant au service) ;
        </li>
        <li>
          usurper une identité ou diffuser des contenus illicites via les
          canaux de contact ;
        </li>
        <li>
          contourner les mesures de sécurité ou les restrictions d&apos;accès du
          Site, notamment celles des contenus réservés aux abonnés.
        </li>
      </ul>

      <h2>6. Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>7. Responsabilité</h2>
      <p>
        L&apos;éditeur ne garantit pas l&apos;absence d&apos;erreurs ni la
        disponibilité continue du Site. L&apos;utilisateur reste responsable de
        l&apos;usage qu&apos;il fait des informations consultées.
      </p>

      <h2>8. Modification des CGU</h2>
      <p>
        Les CGU peuvent être modifiées à tout moment. La version applicable est
        celle publiée sur cette page.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Les présentes CGU sont soumises au droit français. En cas de litige, et
        à défaut d&apos;accord amiable, les tribunaux français sont compétents.
      </p>

      <h2>10. Contact</h2>
      <p>
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a> — voir
        aussi les <Link href="/mentions-legales">mentions légales</Link>.
      </p>

      <p className="mt-10 text-sm text-muted">
        Dernière mise à jour : 30 octobre 2026
      </p>
    </article>
  );
}
