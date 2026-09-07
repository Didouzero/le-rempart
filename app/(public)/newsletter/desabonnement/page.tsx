import type { Metadata } from "next";
import { NewsletterUnsubscribeForm } from "@/components/NewsletterUnsubscribeForm";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Se désabonner de la newsletter",
  description: "Désabonnement de la newsletter gratuite Le Rempart.",
  path: "/newsletter/desabonnement",
});

export default function NewsletterUnsubscribePage() {
  return (
    <article className="animate-fade-up max-w-xl">
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Newsletter
      </p>
      <h1 className="font-display mt-2 text-3xl tracking-[0.08em]">
        Se désabonner
      </h1>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
      <p className="mt-4 text-muted">
        Entrez l&apos;e-mail utilisé pour la newsletter gratuite. Vous ne
        recevrez plus le brief du matin. Pour toute autre demande :{" "}
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a>.
      </p>
      <NewsletterUnsubscribeForm />
    </article>
  );
}
