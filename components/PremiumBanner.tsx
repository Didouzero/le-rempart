import Link from "next/link";
import { CrownIcon } from "@/components/BrandIcons";

/** Bandeau d'en-tête des pages Rempart+ : on voit tout de suite qu'on est dans l'espace premium. */
export function PremiumBanner({
  label,
  subscribed,
}: {
  /** Ex. « Enquête exclusive », « Enquêtes & révélations ». */
  label: string;
  subscribed: boolean;
}) {
  return (
    <div className="relative mb-8 overflow-hidden rounded-lg border border-accent/45 bg-ink px-4 py-3 text-paper shadow-[0_10px_30px_rgba(0,0,0,0.25)] sm:px-6 sm:py-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,189,89,0.22),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-accent-deep via-accent to-accent-deep" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/60 bg-accent/15 text-accent">
            <CrownIcon className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[1.05rem] tracking-[0.22em] text-accent">
              Le Rempart+
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-white/70">
              {label}
            </span>
          </span>
        </div>
        {subscribed ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            Accès abonné
          </span>
        ) : (
          <Link
            href="/s-abonner"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 font-display text-xs tracking-[0.16em] text-ink no-underline transition hover:bg-accent-deep hover:no-underline"
          >
            Réservé aux abonnés · S&apos;abonner
          </Link>
        )}
      </div>
    </div>
  );
}
