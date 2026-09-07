import Link from "next/link";
import { RempartPlusCheckout } from "@/components/RempartPlusCheckout";
import { getStripePublishableKey, isStripeConfigured } from "@/lib/stripe";

const PERKS = [
  {
    kicker: "Chaque matin",
    title: "Le Brief approfondi",
    text: "Les 10 infos essentielles complètes des dernières 24 heures et tout ce que les autres médias glissent sous le tapis. 🗞️",
  },
  {
    kicker: "Exclusif",
    title: "Dossiers & enquêtes",
    text: "Chaque mercredi et samedi, des enquêtes et révélations privées. Des dossiers exclusifs à garder, à envoyer, à relire. 📒",
  },
  {
    kicker: "Confort",
    title: "Site sans publicité",
    text: "Plus aucune publicité sur Le Rempart. Juste l’info, propre, sur tout le site. ✅",
  },
] as const;

type RempartPlusOfferProps = {
  alreadyPlus: boolean;
  status?: "success" | "canceled" | null;
  showHowItWorks?: boolean;
  titleAs?: "h1" | "h2";
};

export function RempartPlusOffer({
  alreadyPlus,
  status = null,
  showHowItWorks = true,
  titleAs = "h1",
}: RempartPlusOfferProps) {
  const Title = titleAs;
  return (
    <div>
      <section className="relative overflow-hidden rounded-lg bg-ink px-5 py-12 text-paper shadow-[var(--shadow-soft)] sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <p className="font-display text-[1.05rem] tracking-[0.22em] text-accent">
          Rempart+
        </p>
        <Title className="font-display mt-3 max-w-3xl text-[2.2rem] leading-[0.95] uppercase sm:text-5xl md:text-6xl">
          Découvrez l&apos;info que les autres n&apos;ont pas.
        </Title>
        <p className="mt-5 max-w-2xl text-base text-white/80 sm:text-lg">
          Pour le prix d’un café, levez le rideau sur nos enquêtes, nos dossiers
          privés et nos révélations documentées. ✍️
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
        <p className="mt-8 rounded-lg border border-accent/50 bg-accent/15 px-5 py-4 text-ink">
          Vous êtes déjà connecté en Rempart+.{" "}
          <Link href="/rubriques/enquetes" className="underline decoration-accent">
            Accéder aux enquêtes
          </Link>
          .
        </p>
      ) : null}

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {PERKS.map((perk, i) => (
          <article
            key={perk.title}
            className="rounded-lg border border-ink/10 bg-white/55 p-5 shadow-[var(--shadow-soft)]"
          >
            <p className="font-display text-xs tracking-[0.18em] text-accent-deep">
              0{i + 1} · {perk.kicker}
            </p>
            <h3 className="font-display mt-3 text-2xl tracking-[0.06em]">
              {perk.title}
            </h3>
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
          <h3 className="font-display mt-2 text-3xl tracking-[0.08em] sm:text-4xl">
            Vous ne payez pas « un média ».
            <br />
            Vous payez un avantage.
          </h3>
          <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
          <div className="mt-6 space-y-4 text-ink">
            <p>
              La newsletter premium donne les gros titres du jour. La
              newsletter payante creuse chaque dossier en profondeur pour vous
              donner une longueur d&apos;avance.
            </p>
            <p>
              Un nouveau dossier exclusif est disponible chaque mercredi et
              samedi : subventions cachées, fraudes politiques, scandales
              migratoires : plongez au cœur de nos enquêtes et découvrez les
              révélations de notre équipe.
            </p>
          </div>
          <p className="mt-6 text-sm text-muted">
            Déjà abonné ?{" "}
            <Link href="/connexion" className="underline decoration-accent">
              Connectez-vous avec votre e-mail
            </Link>{" "}
            — pas de mot de passe à retenir.
          </p>
        </div>

        <div className="rounded-lg border border-ink bg-ink p-6 text-paper sm:p-8">
          <p className="font-display text-sm tracking-[0.18em] text-accent">
            Rejoindre Rempart+
          </p>
          <p className="mt-2 text-white/80">
            Entrez l’e-mail qui servira de clé d’accès. Après le paiement, vous
            êtes connecté tout de suite — et vous pourrez revenir quand vous
            voulez via un lien envoyé dans votre boîte. ✉️
          </p>
          <RempartPlusCheckout
            configured={isStripeConfigured()}
            publishableKey={getStripePublishableKey()}
            status={status}
          />
        </div>
      </section>

      {showHowItWorks ? (
        <>
          <section className="mt-14 border-t border-ink/15 pt-10">
            <h3 className="font-display text-2xl tracking-[0.1em]">
              Que se passe-t-il après mon abonnement ?
            </h3>
            <ol className="mt-5 list-none space-y-4 p-0">
              <li className="flex gap-4">
                <span className="font-display text-accent">1</span>
                <p>
                  Vous payez 4,90&nbsp;€/mois avec l’e-mail de votre choix. Pas
                  de compte à « créer », aucun mot de passe à retenir.
                </p>
              </li>
              <li className="flex gap-4">
                <span className="font-display text-accent">2</span>
                <p>
                  Cet e-mail devient votre accès Le Rempart+. Après votre
                  paiement, vous atterrissez directement dans votre espace
                  abonnés, et vous bénéficiez de tous les avantages du Rempart+.
                </p>
              </li>
              <li className="flex gap-4">
                <span className="font-display text-accent">3</span>
                <p>
                  Si vous changez d&apos;appareil, reconnectez-vous simplement
                  grâce à votre e-mail via le bouton{" "}
                  <Link href="/connexion" className="underline decoration-accent">
                    Se connecter
                  </Link>{" "}
                  en haut à droite.
                </p>
              </li>
            </ol>
          </section>

          <section className="mt-10 border-t border-ink/15 pt-10">
            <h3 className="font-display text-2xl tracking-[0.1em]">
              Que se passe-t-il si je veux résilier ?
            </h3>
            <p className="mt-5 text-ink">
              En bas de chacun des mails que nous vous envoyons, vous avez une
              option de résiliation. Il suffit de cliquer dessus, et de
              confirmer. Vous serez alors désabonné du service Le Rempart+.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
