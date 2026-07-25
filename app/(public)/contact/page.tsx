import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nous contacter",
  description: "Contacter la rédaction du Rempart.",
};

export default function ContactPage() {
  return (
    <article className="animate-fade-up max-w-2xl">
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Contact
      </p>
      <h1 className="font-display mt-2 text-4xl tracking-[0.08em] sm:text-5xl">
        Nous contacter
      </h1>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />

      <p className="mt-8 text-ink">
        Pour toute demande (droit de réponse, signalement, partenariat,
        information), écrivez à la rédaction :
      </p>
      <p className="mt-4">
        <a
          href="mailto:contact@le-rempart.org"
          className="font-display text-xl tracking-[0.08em] text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-deep"
        >
          contact@le-rempart.org
        </a>
      </p>
      <p className="mt-8 text-sm text-muted">
        Merci de préciser l&apos;objet de votre message et, le cas échéant,
        l&apos;URL de l&apos;article concerné.
      </p>
    </article>
  );
}
