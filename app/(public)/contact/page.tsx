import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Nous contacter",
  description:
    "Contacter la rédaction de Le Rempart : droit de réponse, signalement d'une erreur, information, partenariat.",
  path: "/contact",
});

const EMAIL = "contact@le-rempart.org";

const REASONS = [
  ["Nous transmettre une info", "Un fait, un document, un témoignage que les autres médias ignorent.", "Information pour la rédaction"],
  ["Signaler une erreur", "Indiquez l'adresse de l'article et ce qui est inexact.", "Signalement d'une erreur"],
  ["Exercer un droit de réponse", "Vous êtes nommé ou désigné dans un article : envoyez votre réponse.", "Droit de réponse"],
  ["Publicité et partenariats", "Annonceurs, médias, associations : toute proposition de collaboration.", "Partenariat"],
] as const;

export default function ContactPage() {
  return (
    <div className="animate-fade-up grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
      {/* À gauche : l'adresse, en grand, sur fond sombre. */}
      <section className="flex flex-col rounded-lg bg-ink p-8 text-paper sm:p-10">
        <div>
          <p className="font-display text-sm tracking-[0.24em] text-accent uppercase">Contact</p>
          <h1 className="font-display mt-4 text-5xl leading-[1.05] uppercase sm:text-6xl">
            Écrivez à la rédaction
          </h1>
          <p className="mt-5 text-white/70">
            Une seule adresse, lue chaque jour. Précisez l&apos;objet de votre
            message et, si besoin, l&apos;adresse de l&apos;article concerné,
            nous ferons au mieux pour répondre à votre requête.
          </p>
        </div>
        {/* L'adresse occupe l'espace restant, centrée entre le texte et le bas du panneau. */}
        <div className="flex flex-1 items-center py-10 lg:py-0">
          <a
            href={`mailto:${EMAIL}`}
            className="font-display block text-[1.35rem] tracking-[0.03em] text-accent underline decoration-accent/40 decoration-2 underline-offset-8 transition hover:decoration-accent sm:text-2xl"
          >
            {/* Coupure permise seulement après l'arobase, jamais au milieu du domaine. */}
            contact@
            <wbr />
            <span className="whitespace-nowrap">le-rempart.org</span>
          </a>
        </div>
      </section>

      {/* À droite : les motifs, en liste cliquable. */}
      <section>
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          Vous souhaitez…
        </p>
        <ul className="mt-4 list-none border-t-2 border-ink p-0">
          {REASONS.map(([title, text, subject]) => (
            <li key={title} className="border-b border-ink/15">
              <a
                href={`mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`}
                className="group flex items-center justify-between gap-6 py-6 text-ink no-underline hover:no-underline"
              >
                <span>
                  <span className="font-display block text-2xl tracking-[0.05em] transition-colors group-hover:text-accent-deep sm:text-3xl">
                    {title}
                  </span>
                  <span className="mt-1 block text-muted">{text}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted">
          Pour comprendre comment nous travaillons :{" "}
          <Link href="/qui-sommes-nous" className="underline decoration-accent">
            Qui sommes-nous
          </Link>{" "}
          ·{" "}
          <Link href="/mentions-legales" className="underline decoration-accent">
            Mentions légales
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
