import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Suppression des données",
  description:
    "Comment demander la suppression de vos données : newsletter, abonnement Rempart+ et application Meta / Facebook de Le Rempart.",
  path: "/suppression-donnees",
});


export default function SuppressionDonneesPage() {
  return (
    <article className="prose-article max-w-3xl animate-fade-up">
      <h1 className="font-display text-3xl sm:text-4xl">
        Suppression des données
      </h1>
      <p className="mt-4 text-sm text-muted">
        Cette page explique comment demander la suppression de vos données,
        qu&apos;elles soient liées au Site ou à notre application Meta. Elle
        tient aussi lieu de page d&apos;instructions requise par Meta pour les
        applications utilisant sa plateforme.
      </p>

      <h2>1. Nature de l&apos;application</h2>
      <p>
        L&apos;application Meta associée à Le Rempart sert uniquement à{" "}
        <strong>gérer notre propre Page Facebook</strong> (publication de
        contenus d&apos;actualité). Elle n&apos;est pas destinée à des
        utilisateurs finaux tiers et ne propose pas de connexion Facebook sur le
        site grand public.
      </p>

      <h2>2. Quelles données l&apos;application peut-elle concerner ?</h2>
      <p>Dans ce cadre, les données concernées sont essentiellement :</p>
      <ul>
        <li>
          des jetons d&apos;accès techniques nécessaires à la publication sur
          notre Page ;
        </li>
        <li>
          des identifiants de publication (posts, photos, commentaires) créés
          sur notre Page ;
        </li>
        <li>
          éventuellement des informations fournies volontairement par e-mail (
          <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a>
          ).
        </li>
      </ul>
      <p>
        Nous ne collectons pas, via cette application, le contenu du profil
        Facebook d&apos;internautes ni leurs messages privés.
      </p>

      <h2>3. Quelles données le Site conserve-t-il ?</h2>
      <p>En dehors de l&apos;application Meta, le Site enregistre :</p>
      <ul>
        <li>
          pour la newsletter : votre adresse e-mail et les dates
          d&apos;inscription, de confirmation et de désabonnement ;
        </li>
        <li>
          pour un abonnement Rempart+ : votre adresse e-mail, le statut de
          l&apos;abonnement et ses références chez Stripe, notre prestataire de
          paiement. Nous ne conservons pas vos numéros de carte.
        </li>
      </ul>
      <p>
        Le lien « Se désabonner » de la newsletter arrête les envois, mais
        n&apos;efface pas votre adresse de notre base. Pour l&apos;effacer,
        suivez la procédure ci-dessous.
      </p>

      <h2>4. Comment demander une suppression</h2>
      <p>
        Pour demander la suppression de données personnelles liées au Site ou
        à l&apos;application, envoyez un e-mail à :
      </p>
      <p>
        <a href="mailto:contact@le-rempart.org?subject=Suppression%20de%20donn%C3%A9es%20Le%20Rempart">
          contact@le-rempart.org
        </a>
      </p>
      <p>Indiquez :</p>
      <ul>
        <li>l&apos;objet : « Suppression de données Le Rempart » ;</li>
        <li>
          l&apos;adresse e-mail concernée, ou votre nom ou identifiant Facebook
          si la demande porte sur l&apos;application Meta ;
        </li>
        <li>
          une description précise de la demande (données concernées, URL
          éventuelle).
        </li>
      </ul>
      <p>
        Nous répondons sous un mois au plus et procédons à la suppression ou à
        l&apos;anonymisation des données personnelles concernées, sauf
        obligation légale de conservation.
      </p>

      <h2>5. Contenu public sur la Page</h2>
      <p>
        Les publications déjà visibles sur la Page Facebook Le Rempart font
        partie de la communication éditoriale de la Page. Leur retrait éventuel
        relève de la modération de la Page et peut être demandé à la même
        adresse e-mail.
      </p>

      <h2>6. Documents associés</h2>
      <p>
        Voir aussi la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link> et
        les <Link href="/cgu">conditions d&apos;utilisation</Link>.
      </p>

      <p className="mt-10 text-sm text-muted">
        Dernière mise à jour : 30 octobre 2026
      </p>
    </article>
  );
}
