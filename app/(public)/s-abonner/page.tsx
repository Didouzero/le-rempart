import type { Metadata } from "next";
import { RempartPlusCheckout } from "@/components/RempartPlusCheckout";
import { buildPageMetadata } from "@/lib/seo";
import { isStripeConfigured, getStripePublishableKey } from "@/lib/stripe";
import { rempartPlusPriceLabel } from "@/lib/membership";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "S'abonner au Rempart+",
  description:
    "Rempart+ à 4,90 €/mois : brief approfondi chaque matin, dossiers exclusifs, site sans publicité.",
  path: "/s-abonner",
});

type Props = {
  searchParams: Promise<{ success?: string; canceled?: string }>;
};

export default async function SabonnerPage({ searchParams }: Props) {
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
        Rempart+
      </p>
      <h1 className="font-display mt-2 text-4xl tracking-[0.08em] sm:text-5xl">
        S&apos;abonner au Rempart+
      </h1>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
      <p className="mt-6 text-lg text-ink">
        {rempartPlusPriceLabel()} — résiliable à tout moment.
      </p>

      <ul className="mt-8 list-none space-y-4 p-0 text-ink">
        <li className="border-l-2 border-accent pl-4">
          <strong className="font-display tracking-[0.08em]">
            Le Brief approfondi
          </strong>
          <p className="mt-1 text-muted">
            Chaque matin, la version Rempart+ du brief : les 10 infos
            essentielles, détaillées un cran plus loin.
          </p>
        </li>
        <li className="border-l-2 border-accent pl-4">
          <strong className="font-display tracking-[0.08em]">
            Dossiers &amp; analyses
          </strong>
          <p className="mt-1 text-muted">
            Enquêtes et dossiers spéciaux réservés aux abonnés, progressivement
            enrichis sur le site.
          </p>
        </li>
        <li className="border-l-2 border-accent pl-4">
          <strong className="font-display tracking-[0.08em]">
            Site sans publicité
          </strong>
          <p className="mt-1 text-muted">
            Lecture sans native ads ni emplacements publicitaires.
          </p>
        </li>
      </ul>

      <p className="mt-8 text-sm text-muted">
        La newsletter gratuite (10 brèves à 7&nbsp;h) reste ouverte à tous. Rempart+
        ajoute le brief approfondi, les dossiers et le confort sans pubs.
      </p>

      <RempartPlusCheckout
        configured={isStripeConfigured()}
        publishableKey={getStripePublishableKey()}
        status={status}
      />
    </article>
  );
}
