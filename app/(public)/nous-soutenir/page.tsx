import type { Metadata } from "next";
import { DonateForm } from "@/components/DonateForm";
import { getStripePublishableKey, isStripeConfigured } from "@/lib/stripe";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Nous soutenir",
  description:
    "Soutenez Le Rempart par un don ponctuel. Média indépendant, sans subvention publique.",
  path: "/nous-soutenir",
});


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
        Nous voulons continuer à produire une information indépendante, sans
        dépendre des subventions publiques ni des grands groupes de presse.
      </p>
      <p className="mt-4 text-lg text-ink">
        Chaque jour, notre rédaction surveille des centaines de sources pour
        sélectionner les informations que les médias traditionnels délaissent.
      </p>
      <p className="mt-4 text-lg text-ink">
        Si vous estimez que ce travail doit continuer, vous pouvez nous aider à
        financer notre média. ✍️
      </p>
      <p className="mt-4 text-muted">
        Choisissez un montant, un moyen de paiement, puis validez. Le paiement
        est sécurisé via Stripe. Pour l&apos;abonnement Rempart+ (4,90&nbsp;€/mois),
        rendez-vous sur{" "}
        <a href="/s-abonner" className="text-ink underline decoration-accent">
          S&apos;abonner
        </a>
        .
      </p>

      <DonateForm
        configured={isStripeConfigured()}
        publishableKey={getStripePublishableKey()}
        status={status}
      />
    </article>
  );
}
