import type { Metadata } from "next";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Se désabonner de la newsletter",
  description: "Désabonnement de la newsletter gratuite Le Rempart.",
  path: "/newsletter/desabonnement",
});

export default function NewsletterUnsubscribePage() {
  return (
    <article className="animate-fade-up max-w-xl">
      <h1 className="font-display text-3xl tracking-[0.08em]">
        Newsletter
      </h1>
      <p className="mt-4 text-muted">
        Pour vous désabonner, écrivez à{" "}
        <a href="mailto:contact@le-rempart.org">contact@le-rempart.org</a> avec
        l&apos;objet « désabonnement », ou réabonnez-vous ci-dessous si vous
        aviez quitté la liste par erreur.
      </p>
      <NewsletterSignup source="unsubscribe-page" />
    </article>
  );
}
