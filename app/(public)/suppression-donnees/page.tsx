import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Suppression des données",
  description:
    "Instructions de suppression des données liées à l'application Meta Le Rempart.",
};

export default function SuppressionDonneesPage() {
  return (
    <article className="prose-article max-w-3xl animate-fade-up">
      <h1 className="font-display text-3xl sm:text-4xl">
        Suppression des données
      </h1>
      <p className="mt-4 text-sm text-muted">
        Page d&apos;instructions requise par Meta pour les applications
        utilisant la plateforme Facebook / Instagram.
      </p>

      <h2>1. Nature de l&apos;application</h2>
      <p>
        L&apos;application Meta associée à Le Rempart sert uniquement à{" "}
        <strong>gérer notre propre Page Facebook</strong> (publication de
        contenus d&apos;actualité). Elle n&apos;est pas destinée à des
        utilisateurs finaux tiers et ne propose pas de connexion Facebook sur le
        site grand public.
      </p>

      <h2>2. Quelles données peuvent exister ?</h2>
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

      <h2>3. Comment demander une suppression</h2>
      <p>
        Pour demander la suppression de données personnelles susceptibles
        d&apos;être liées à l&apos;application ou au Site, envoyez un e-mail à
        :
      </p>
      <p>
        <a href="mailto:contact@le-rempart.org?subject=Demande%20de%20suppression%20de%20donnees%20Meta">
          contact@le-rempart.org
        </a>
      </p>
      <p>Indiquez :</p>
      <ul>
        <li>l&apos;objet : « Suppression de données Meta / Le Rempart » ;</li>
        <li>
          votre nom ou identifiant Facebook concerné, si applicable ;
        </li>
        <li>
          une description précise de la demande (données concernées, URL
          éventuelle).
        </li>
      </ul>
      <p>
        Nous accusons réception sous un délai raisonnable et procédons à la
        suppression ou à l&apos;anonymisation des données personnelles
        concernées, sauf obligation légale de conservation.
      </p>

      <h2>4. Contenu public sur la Page</h2>
      <p>
        Les publications déjà visibles sur la Page Facebook Le Rempart font
        partie de la communication éditoriale de la Page. Leur retrait éventuel
        relève de la modération de la Page et peut être demandé à la même
        adresse e-mail.
      </p>

      <h2>5. Documents associés</h2>
      <p>
        Voir aussi la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link> et
        les <Link href="/cgu">conditions d&apos;utilisation</Link>.
      </p>

      <p className="mt-10 text-sm text-muted">
        Dernière mise à jour : 25 juillet 2026
      </p>
    </article>
  );
}
