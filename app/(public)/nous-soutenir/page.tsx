import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nous soutenir",
  description: "Soutenir Le Rempart.",
};

export default function NousSoutenirPage() {
  return (
    <article className="animate-fade-up max-w-2xl">
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Soutien
      </p>
      <h1 className="font-display mt-2 text-4xl tracking-[0.08em] sm:text-5xl">
        Nous soutenir
      </h1>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />

      <p className="mt-10 text-lg text-ink">
        Cette page sera bientôt disponible.
      </p>
      <p className="mt-4 text-muted">
        Merci pour votre intérêt. Les modalités de soutien au Rempart seront
        publiées ici prochainement.
      </p>
    </article>
  );
}
