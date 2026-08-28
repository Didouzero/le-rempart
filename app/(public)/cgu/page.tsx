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
        En accédant au site Le Rempart, vous acceptez les présentes conditions.
      </p>

      <h2>1. Objet</h2>
      <p>
        Les présentes CGU encadrent l&apos;accès et l&apos;utilisation du Site
        d&apos;information Le Rempart, édité à l&apos;adresse{" "}
        <a href="https://www.le-rempart.org">www.le-rempart.org</a>.
      </p>

      <h2>2. Accès au Site</h2>
      <p>
        Le Site est accessible gratuitement (hors coûts de connexion).
        L&apos;éditeur peut suspendre ou modifier le Site sans préavis pour
        maintenance, sécurité ou évolution éditoriale.
      </p>

      <h2>3. Contenus d&apos;information</h2>
      <p>
        Les articles, titres et illustrations ont un objet informatif et/ou
        d&apos;opinion. Ils ne constituent pas une invitation à la haine, à la
        violence ou à des actes illégaux. Toute ressemblance avec des situations
        réelles dans des contenus satiriques ou commentés relève du débat
        d&apos;intérêt général, dans le respect du droit applicable.
      </p>
      <p>
        L&apos;utilisateur s&apos;engage à ne pas reproduire massivement les
        contenus, ni à les utiliser de manière trompeuse, commerciale non
        autorisée, ou portant atteinte aux droits de tiers.
      </p>

      <h2>4. Comportements interdits</h2>
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
          contourner les mesures de sécurité ou d&apos;accès à l&apos;espace
          d&apos;administration.
        </li>
      </ul>

      <h2>5. Espace d&apos;administration</h2>
      <p>
        L&apos;accès à l&apos;administration est réservé aux personnes
        autorisées. Toute tentative d&apos;accès non autorisé est interdite et
        peut faire l&apos;objet de poursuites.
      </p>

      <h2>6. Données personnelles</h2>
      <p>
        Voir la{" "}
        <Link href="/confidentialite">Politique de confidentialité</Link>.
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

      <h2>9. Contact</h2>
      <p>
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a> — voir
        aussi les <Link href="/mentions-legales">mentions légales</Link>.
      </p>

      <p className="mt-10 text-sm text-muted">
        Dernière mise à jour : 25 juillet 2026
      </p>
    </article>
  );
}
