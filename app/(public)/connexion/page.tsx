import type { Metadata } from "next";
import Link from "next/link";
import { PlusLoginForm } from "@/components/PlusLoginForm";
import { hasActiveRempartPlus } from "@/lib/membership";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Connexion Rempart+",
  description:
    "Accédez à votre espace Rempart+ avec un lien envoyé sur votre e-mail d’abonnement.",
  path: "/connexion",
});

type Props = {
  searchParams: Promise<{ expired?: string }>;
};

export default async function ConnexionPage({ searchParams }: Props) {
  const params = await searchParams;
  const already = await hasActiveRempartPlus();

  return (
    <article className="animate-fade-up max-w-xl">
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Espace abonné
      </p>
      <h1 className="font-display mt-2 text-4xl tracking-[0.08em]">
        Connexion Rempart+
      </h1>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
      <p className="mt-5 text-ink">
        Pas de mot de passe. Entrez l’e-mail utilisé pour l’abonnement : on
        vous envoie un lien, vous cliquez, vous êtes dans les dossiers.
      </p>
      {already ? (
        <p className="mt-6 border border-accent/40 bg-accent/15 px-4 py-3">
          Vous êtes déjà connecté.{" "}
          <Link href="/dossiers" className="underline decoration-accent">
            Voir les dossiers
          </Link>
          .
        </p>
      ) : null}
      {params.expired === "1" ? (
        <p className="mt-6 text-sm text-muted">
          Ce lien a expiré. Demandez-en un nouveau ci-dessous.
        </p>
      ) : null}
      <PlusLoginForm />
      <p className="mt-8 text-sm text-muted">
        Pas encore abonné ?{" "}
        <Link href="/s-abonner" className="underline decoration-accent">
          Découvrir Rempart+
        </Link>
      </p>
    </article>
  );
}
