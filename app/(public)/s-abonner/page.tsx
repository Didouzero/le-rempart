import type { Metadata } from "next";
import { RempartPlusOffer } from "@/components/RempartPlusOffer";
import { hasActiveRempartPlus } from "@/lib/membership";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "S'abonner au Rempart+",
  description:
    "Rempart+ à 4,90 €/mois : le brief approfondi chaque matin, les dossiers exclusifs, et un site sans publicité.",
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
  const alreadyPlus = await hasActiveRempartPlus();

  return (
    <div className="animate-fade-up">
      <RempartPlusOffer
        alreadyPlus={alreadyPlus}
        status={status}
        showHowItWorks
        titleAs="h1"
      />
    </div>
  );
}
