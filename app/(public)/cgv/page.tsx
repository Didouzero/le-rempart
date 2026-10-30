import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Conditions générales de vente",
  description:
    "Conditions générales de vente de l'abonnement Rempart+ : prix, renouvellement, résiliation et rétractation.",
  path: "/cgv",
});


export default function CgvPage() {
  return (
    <article className="prose-article max-w-3xl animate-fade-up">
      <h1 className="font-display text-3xl sm:text-4xl">
        Conditions générales de vente
      </h1>
      <p className="mt-4 text-sm text-muted">
        Les présentes conditions s&apos;appliquent à l&apos;abonnement Rempart+,
        souscrit sur le site{" "}
        <a href="https://www.le-rempart.org">www.le-rempart.org</a> (le
        « Site »).
      </p>

      <h2>1. Vendeur</h2>
      <p>
        L&apos;abonnement est proposé par l&apos;éditeur du Site, présenté dans
        les <Link href="/mentions-legales">mentions légales</Link> et joignable
        à <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a>.
      </p>

      <h2>2. Service</h2>
      <p>Rempart+ est un abonnement numérique qui donne accès :</p>
      <ul>
        <li>à une version approfondie du brief quotidien, envoyée par e-mail ;</li>
        <li>aux enquêtes et dossiers réservés aux abonnés ;</li>
        <li>au Site sans publicité.</li>
      </ul>
      <p>
        L&apos;accès est lié à l&apos;adresse e-mail indiquée lors de la
        souscription. Il ne nécessite pas de mot de passe : un lien de connexion
        est envoyé à cette adresse. L&apos;abonnement est personnel.
      </p>

      <h2>3. Prix et paiement</h2>
      <p>
        L&apos;abonnement coûte <strong>4,90&nbsp;€ par mois</strong>, toutes
        taxes comprises. Le paiement s&apos;effectue par carte via Stripe, notre
        prestataire de paiement. Nous n&apos;avons pas accès à vos numéros de
        carte.
      </p>

      <h2>4. Durée et renouvellement</h2>
      <p>
        L&apos;abonnement est sans engagement. Il est conclu pour un mois et se
        renouvelle automatiquement chaque mois, à la date anniversaire de la
        souscription, jusqu&apos;à sa résiliation.
      </p>

      <h2>5. Résiliation</h2>
      <p>
        Vous pouvez résilier à tout moment, en ligne, sur la page{" "}
        <Link href="/resilier">Résilier Rempart+</Link>, accessible en bas de
        chaque page du Site. La résiliation arrête tout nouveau prélèvement, et
        votre accès reste ouvert jusqu&apos;à la fin de la période déjà payée.
        Nous vous la confirmons par e-mail. Le mois en cours n&apos;est pas
        remboursé, sauf exercice du droit de rétractation.
      </p>

      <h2>6. Droit de rétractation</h2>
      <p>
        Vous disposez de 14 jours à compter de la souscription pour vous
        rétracter, sans avoir à vous justifier. Il vous suffit de nous écrire à{" "}
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a>, par
        exemple avec ce message :
      </p>
      <blockquote>
        Je vous notifie ma rétractation du contrat d&apos;abonnement Rempart+
        souscrit le [date], avec l&apos;adresse e-mail [adresse]. [Nom et date]
      </blockquote>
      <p>
        Nous vous remboursons intégralement sous 14 jours, par le moyen de
        paiement utilisé lors de la souscription. L&apos;accès à Rempart+ prend
        alors fin.
      </p>

      <h2>7. Réclamations</h2>
      <p>
        Pour toute réclamation :{" "}
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a>. Nous
        répondons sous un mois au plus.
      </p>

      <h2>8. Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Les présentes conditions sont soumises au droit français. En cas de
        litige, et à défaut d&apos;accord amiable, les tribunaux français sont
        compétents, sans préjudice des règles protectrices du consommateur.
      </p>

      <p className="mt-10 text-sm text-muted">
        Dernière mise à jour : 30 octobre 2026
      </p>
    </article>
  );
}
