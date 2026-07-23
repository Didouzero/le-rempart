import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="font-display text-4xl">Introuvable</h1>
      <p className="mt-3 text-muted">Cette page n&apos;existe pas ou n&apos;est plus publiée.</p>
      <Link href="/" className="mt-8 inline-block font-semibold">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
