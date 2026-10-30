import type { Metadata } from "next";
import Link from "next/link";
import { PlusCancelForm } from "@/components/PlusCancelForm";
import { getPlusEmail, verifyPlusCancelToken } from "@/lib/membership";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Résilier Rempart+",
  description: "Résiliez en ligne votre abonnement Rempart+, à tout moment.",
  path: "/resilier",
});

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResilierPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const tokenEmail = token ? verifyPlusCancelToken(token) : null;
  const email = tokenEmail || (await getPlusEmail());

  return (
    <article className="animate-fade-up max-w-xl">
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Rempart+
      </p>
      <h1 className="font-display mt-2 text-3xl tracking-[0.08em]">
        Résilier mon abonnement
      </h1>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
      <p className="mt-4 text-muted">
        Vous pouvez résilier à tout moment. Aucun nouveau prélèvement n&apos;est
        effectué, et votre accès reste ouvert jusqu&apos;à la fin de la période
        déjà payée. Pour vous arrêter à la newsletter gratuite, utilisez plutôt
        la page de{" "}
        <Link href="/newsletter/desabonnement" className="underline decoration-accent">
          désabonnement
        </Link>
        .
      </p>
      {token && !tokenEmail ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          Ce lien a expiré. Demandez-en un nouveau ci-dessous.
        </p>
      ) : null}
      <PlusCancelForm email={email} token={tokenEmail ? token! : null} />
    </article>
  );
}
