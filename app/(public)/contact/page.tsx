import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Nous contacter",
  description:
    "Contacter la rédaction de Le Rempart : droit de réponse, signalement d'une erreur, information, partenariat.",
  path: "/contact",
});

const EMAIL = "contact@le-rempart.org";

const REASONS = [
  {
    kicker: "Information",
    title: "Nous transmettre une info",
    text: "Un fait, un document, un témoignage que les autres médias ignorent ? Racontez-nous.",
    subject: "Information pour la rédaction",
  },
  {
    kicker: "Exactitude",
    title: "Signaler une erreur",
    text: "Indiquez l'adresse de l'article et ce qui est inexact : nous corrigeons les erreurs avérées.",
    subject: "Signalement d'une erreur",
  },
  {
    kicker: "Vos droits",
    title: "Droit de réponse",
    text: "Vous êtes nommé ou désigné dans un article ? Envoyez votre réponse et l'adresse de l'article.",
    subject: "Droit de réponse",
  },
  {
    kicker: "Partenariat",
    title: "Publicité et partenariats",
    text: "Annonceurs, médias, associations : écrivez-nous pour toute proposition de collaboration.",
    subject: "Partenariat",
  },
] as const;

export default function ContactPage() {
  return (
    <div className="animate-fade-up">
      <PageHero
        kicker="Contact"
        title="Nous contacter"
        lead="Une seule adresse pour joindre la rédaction. Précisez l'objet de votre message et, le cas échéant, l'adresse de l'article concerné."
        image="/rempart-plus-hero.jpg"
      >
        <a
          href={`mailto:${EMAIL}`}
          className="font-display mt-8 inline-block rounded-lg border border-accent/50 bg-accent px-5 py-3 text-lg tracking-[0.12em] text-ink no-underline shadow-[0_8px_24px_rgba(255,189,89,0.35)] transition duration-300 hover:-translate-y-0.5 hover:bg-accent-deep hover:no-underline"
        >
          {EMAIL}
        </a>
      </PageHero>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {REASONS.map((r, i) => (
          <a
            key={r.title}
            href={`mailto:${EMAIL}?subject=${encodeURIComponent(r.subject)}`}
            className="group block rounded-lg border border-ink/10 bg-white/55 p-5 text-ink no-underline shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:no-underline"
          >
            <p className="font-display text-xs tracking-[0.18em] text-accent-deep">
              0{i + 1} · {r.kicker}
            </p>
            <h2 className="font-display mt-3 text-2xl tracking-[0.06em] transition-colors group-hover:text-accent-deep">
              {r.title}
            </h2>
            <p className="mt-3 text-[0.95rem] text-muted">{r.text}</p>
            <p className="font-display mt-4 text-sm tracking-[0.12em] text-accent-deep">
              Écrire →
            </p>
          </a>
        ))}
      </section>

      <p className="mt-10 text-sm text-muted">
        Pour en savoir plus sur notre fonctionnement :{" "}
        <Link href="/qui-sommes-nous" className="underline decoration-accent">
          Qui sommes-nous
        </Link>{" "}
        ·{" "}
        <Link href="/mentions-legales" className="underline decoration-accent">
          Mentions légales
        </Link>
        .
      </p>
    </div>
  );
}
