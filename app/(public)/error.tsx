"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Erreur passagère (base de données endormie, panne réseau) : une page à l'identité
 * du site plutôt que l'écran anglais par défaut, avec un bouton pour réessayer.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16 text-center sm:py-24">
      <p className="section-kicker justify-center">
        <span className="live-dot" aria-hidden />
        Incident momentané
      </p>
      <h1 className="font-headline mt-4 text-3xl leading-tight sm:text-4xl">
        La page n&apos;a pas pu s&apos;afficher
      </h1>
      <p className="mt-4 text-muted">
        Un incident technique passager empêche son chargement. Réessayez dans un instant : il
        se règle le plus souvent tout seul.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="font-display rounded-lg bg-accent px-5 py-2.5 text-[0.95rem] tracking-[0.07em] text-[#0a0a0a] transition hover:bg-accent-deep"
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="font-display rounded-lg border border-rule px-5 py-2.5 text-[0.95rem] tracking-[0.07em] text-ink no-underline transition hover:border-accent hover:text-gold hover:no-underline"
        >
          Revenir à la une
        </Link>
      </div>
    </div>
  );
}
