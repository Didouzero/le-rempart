import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center sm:py-24">
      <p className="section-kicker justify-center">Erreur 404</p>
      <h1 className="font-headline mt-3 text-4xl leading-tight sm:text-5xl">Cette page est introuvable</h1>
      <p className="mt-4 text-muted">
        L&apos;adresse est erronée, ou l&apos;article n&apos;est plus publié.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="font-display rounded-md bg-accent px-5 py-2.5 text-[0.95rem] tracking-[0.07em] text-ink no-underline hover:bg-accent-deep hover:no-underline"
        >
          Revenir à la une
        </Link>
        <Link
          href="/?page=2"
          className="font-display rounded-md border border-rule px-5 py-2.5 text-[0.95rem] tracking-[0.07em] no-underline hover:border-accent hover:text-gold hover:no-underline"
        >
          Toutes les actualités
        </Link>
      </div>
    </div>
  );
}
