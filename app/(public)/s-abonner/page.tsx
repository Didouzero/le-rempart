import type { Metadata } from "next";
import Link from "next/link";
import { RempartPlusCheckout } from "@/components/RempartPlusCheckout";
import { hasActiveRempartPlus, rempartPlusPriceLabel } from "@/lib/membership";
import { buildPageMetadata } from "@/lib/seo";
import { getStripePublishableKey, isStripeConfigured } from "@/lib/stripe";

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

const PERKS = [
  {
    kicker: "Chaque matin",
    title: "Le Brief approfondi",
    text: "Les 10 infos essentielles, mais avec le contexte, les noms, les chiffres et ce que les autres médias glissent sous le tapis.",
  },
  {
    kicker: "Exclusif",
    title: "Dossiers & enquêtes",
    text: "Des analyses longues, réservées aux abonnés. Le genre de lecture qu’on garde, qu’on envoie, qu’on relit.",
  },
  {
    kicker: "Confort",
    title: "Site sans publicité",
    text: "Plus de native ads, plus de bannières. Juste l’info, propre, sur tout le site.",
  },
] as const;

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
      <section className="relative overflow-hidden bg-ink px-5 py-12 text-paper shadow-[var(--shadow-soft)] sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <p className="font-display text-sm tracking-[0.22em] text-accent">
          Rempart+
        </p>
        <h1 className="font-display mt-3 max-w-3xl text-[2.2rem] leading-[0.95] sm:text-5xl md:text-6xl">
          L’info que les autres n’osent pas tenir jusqu’au bout.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-white/80 sm:text-lg">
          Pour le prix d’un café, vous financez une rédaction indépendante —
          et vous recevez chaque matin le brief que vos potes n’auront pas.
        </p>
        <div className="mt-8 flex flex-wrap items-end gap-4">
          <p className="font-display text-5xl leading-none tracking-[0.04em] text-accent">
            4,90&nbsp;€
          </p>
          <p className="pb-1 text-sm text-white/70">
            / mois · sans engagement · résiliable en 2 clics
          </p>
        </div>
      </section>

      {alreadyPlus ? (
        <p className="mt-8 border border-accent/50 bg-accent/15 px-5 py-4 text-ink">
          Vous êtes déjà connecté en Rempart+.{" "}
          <Link href="/dossiers" className="underline decoration-accent">
            Accéder aux dossiers
          </Link>
          .
        </p>
      ) : null}

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {PERKS.map((perk, i) => (
          <article
            key={perk.title}
            className="border border-ink/10 bg-white/55 p-5 shadow-[var(--shadow-soft)]"
          >
            <p className="font-display text-xs tracking-[0.18em] text-accent-deep">
              0{i + 1} · {perk.kicker}
            </p>
            <h2 className="font-display mt-3 text-2xl tracking-[0.06em]">
              {perk.title}
            </h2>
            <p className="mt-3 text-[0.95rem] text-muted">{perk.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="section-kicker">
            <span className="live-dot" aria-hidden />
            Pourquoi c’est rentable
          </p>
          <h2 className="font-display mt-2 text-3xl tracking-[0.08em] sm:text-4xl">
            Vous ne payez pas « un média ».
            <br />
            Vous payez un avantage.
          </h2>
          <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
          <ul className="mt-6 list-none space-y-3 p-0 text-ink">
            <li>Le brief gratuit donne le titre. Le brief + donne l’affaire.</li>
            <li>Les dossiers exclusifs : le fond, pas le bruit de la journée.</li>
            <li>Zéro pub. Votre lecture n’est plus un produit d’appel.</li>
            <li>
              {rempartPlusPriceLabel()} — moins cher qu’un quotidien, et sans
              ligne éditoriale ministérielle.
            </li>
          </ul>
          <p className="mt-6 text-sm text-muted">
            Déjà abonné ?{" "}
            <Link href="/connexion" className="underline decoration-accent">
              Connectez-vous avec votre e-mail
            </Link>{" "}
            — pas de mot de passe à retenir.
          </p>
        </div>

        <div className="border border-ink bg-ink p-6 text-paper sm:p-8">
          <p className="font-display text-sm tracking-[0.18em] text-accent">
            Rejoindre Rempart+
          </p>
          <p className="mt-2 text-white/80">
            Entrez l’e-mail qui servira de clé d’accès. Après le paiement, vous
            êtes connecté tout de suite — et vous pourrez revenir quand vous
            voulez via un lien envoyé dans votre boîte.
          </p>
          <RempartPlusCheckout
            configured={isStripeConfigured()}
            publishableKey={getStripePublishableKey()}
            status={status}
          />
        </div>
      </section>

      <section className="mt-14 border-t border-ink/15 pt-10">
        <h2 className="font-display text-2xl tracking-[0.1em]">
          Comment j’accède aux dossiers ?
        </h2>
        <ol className="mt-5 list-none space-y-4 p-0">
          <li className="flex gap-4">
            <span className="font-display text-accent">1</span>
            <p>
              Vous payez 4,90&nbsp;€/mois avec l’e-mail de votre choix. Pas de
              compte à « créer », pas de mot de passe à inventer.
            </p>
          </li>
          <li className="flex gap-4">
            <span className="font-display text-accent">2</span>
            <p>
              Cet e-mail devient votre accès Rempart+. Après Stripe, vous
              atterrissez directement dans l’espace dossiers.
            </p>
          </li>
          <li className="flex gap-4">
            <span className="font-display text-accent">3</span>
            <p>
              Sur un autre téléphone ou après avoir vidé les cookies :{" "}
              <Link href="/connexion" className="underline decoration-accent">
                /connexion
              </Link>
              , vous entrez le même e-mail, vous cliquez le lien reçu, et vous
              êtes dedans.
            </p>
          </li>
        </ol>
      </section>
    </div>
  );
}
