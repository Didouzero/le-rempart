import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales du site Le Rempart.",
};

export default function MentionsLegalesPage() {
  return (
    <article className="prose-article max-w-3xl animate-fade-up">
      <h1 className="font-display text-3xl sm:text-4xl">Mentions légales</h1>
      <p className="mt-4 text-sm text-muted">
        Conformément à la loi n°2004-575 du 21 juin 2004 pour la confiance dans
        l&apos;économie numérique (LCEN).
      </p>

      <h2>1. Éditeur du site</h2>
      <p>
        Le site <strong>Le Rempart</strong> (ci-après « le Site »), accessible à
        l&apos;adresse{" "}
        <a href="https://www.le-rempart.org">https://www.le-rempart.org</a>, est
        un site d&apos;information et d&apos;actualité.
      </p>
      <ul>
        <li>
          <strong>Nom / raison sociale de l&apos;éditeur :</strong> Le Rempart
        </li>
        <li>
          <strong>Directeur de la publication :</strong> à compléter (nom du
          responsable éditorial)
        </li>
        <li>
          <strong>Contact :</strong>{" "}
          <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a>
        </li>
        <li>
          <strong>Statut :</strong> site d&apos;information en ligne
        </li>
      </ul>
      <p className="text-sm text-muted">
        Si vous exercez en société ou en micro-entreprise, indiquez ici le
        numéro SIREN/SIRET, la forme juridique et l&apos;adresse du siège.
      </p>

      <h2>2. Hébergement</h2>
      <p>Le Site est hébergé par :</p>
      <ul>
        <li>
          <strong>Vercel Inc.</strong>
        </li>
        <li>440 N Barranca Ave #4133, Covina, CA 91723, États-Unis</li>
        <li>
          Site :{" "}
          <a href="https://vercel.com" rel="noopener noreferrer" target="_blank">
            https://vercel.com
          </a>
        </li>
      </ul>
      <p>
        La base de données peut être hébergée via un prestataire cloud (notamment
        Neon / PostgreSQL) aux États-Unis ou dans l&apos;Espace économique
        européen, selon la configuration en vigueur.
      </p>

      <h2>3. Nature du Site</h2>
      <p>
        Le Rempart publie des articles d&apos;actualité, des analyses et des
        contenus d&apos;information à caractère politique, social ou
        institutionnel. Les opinions exprimées dans les articles n&apos;engagent
        que leurs auteurs et ne constituent pas des conseils juridiques,
        financiers ou professionnels.
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des contenus du Site (textes, logos, éléments
        graphiques, structure), sauf mention contraire, est protégé par le droit
        d&apos;auteur. Toute reproduction non autorisée est interdite.
      </p>
      <p>
        Les images d&apos;illustration peuvent provenir de banques d&apos;images
        libres de droits, de Wikimedia Commons, d&apos;Openverse ou d&apos;autres
        sources autorisées. Les droits restent ceux des titulaires d&apos;origine
        le cas échéant.
      </p>
      <p>
        Les créatives publicitaires / visuels envoyés par la rédaction pour
        diffusion restent la propriété de leurs auteurs.
      </p>

      <h2>5. Responsabilité</h2>
      <p>
        L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude des
        informations publiées, sans garantie d&apos;exhaustivité. L&apos;éditeur
        ne saurait être tenu responsable des dommages résultant de
        l&apos;utilisation du Site ou de l&apos;interprétation des contenus.
      </p>
      <p>
        Le Site peut contenir des liens vers des sites tiers. L&apos;éditeur
        n&apos;exerce aucun contrôle sur ces sites et décline toute
        responsabilité quant à leur contenu.
      </p>

      <h2>6. Droit de réponse</h2>
      <p>
        Conformément à la législation applicable à la communication au public en
        ligne, toute personne nommée ou désignée dans un contenu publié sur le
        Site peut exercer un droit de réponse. Adressez votre demande à{" "}
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a> en
        précisant l&apos;URL de l&apos;article et le contenu demandé.
      </p>

      <h2>7. Signalement de contenus</h2>
      <p>
        Pour signaler un contenu illicite ou une atteinte aux droits de tiers :
        <a href="mailto:contact@le-rempart.org"> contact@le-rempart.org</a>.
      </p>

      <h2>8. Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la{" "}
        <Link href="/confidentialite">Politique de confidentialité</Link>.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Les présentes mentions sont régies par le droit français. En cas de
        litige, et à défaut d&apos;accord amiable, les tribunaux français
        seront compétents.
      </p>

      <p className="mt-10 text-sm text-muted">
        Dernière mise à jour : 25 juillet 2026
      </p>
    </article>
  );
}
