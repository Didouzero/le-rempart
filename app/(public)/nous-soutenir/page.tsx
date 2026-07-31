import type { Metadata } from "next";
import { DonateForm } from "@/components/DonateForm";
import { getStripePublishableKey, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nous soutenir",
  description: "Soutenir Le Rempart par un don ponctuel.",
};

type Props = {
  searchParams: Promise<{ success?: string; canceled?: string }>;
};

export default async function NousSoutenirPage({ searchParams }: Props) {
  const params = await searchParams;
  const status =
    params.success === "1"
      ? ("success" as const)
      : params.canceled === "1"
        ? ("canceled" as const)
        : null;

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

      <p className="mt-8 text-lg text-ink">
        Le Rempart vit grâce à ses lecteurs. Un don ponctuel finance la
        rédaction, la veille et la publication — sans dépendance aux
        subventions ni aux grands groupes.
      </p>
      <p className="mt-4 text-muted">
        Choisissez un montant, un moyen de paiement, puis validez. Le paiement
        est sécurisé via Stripe.
      </p>

      <DonateForm
        configured={isStripeConfigured()}
        publishableKey={getStripePublishableKey()}
        status={status}
      />
    </article>
  );
}
