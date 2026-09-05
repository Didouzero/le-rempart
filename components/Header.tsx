import Image from "next/image";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";

type HeaderProps = {
  compact?: boolean;
};

export function Header({ compact = false }: HeaderProps) {
  return (
    <header className="marble-band text-paper">
      <SiteNav />

      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-80" />

      <div className="ticker" aria-label="Devise du média">
        <div className="ticker-track">
          <span>Le Rempart — Le média de droite radicale</span>
          <span className="ticker-white">Actualité de droite</span>
          <span>Le Rempart — Le média de droite radicale</span>
          <span className="ticker-white">Actualité de droite</span>
          <span>Le Rempart — Le média de droite radicale</span>
          <span className="ticker-white">Actualité de droite</span>
          <span>Le Rempart — Le média de droite radicale</span>
          <span className="ticker-white">Actualité de droite</span>
        </div>
      </div>

      {!compact && (
        <div className="border-t border-white/10">
          <div className="animate-fade-in relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-9 pt-16 text-center sm:px-6 sm:pb-12 sm:pt-14">
            <Link
              href="/s-abonner"
              className="group absolute right-2 top-2 z-10 inline-flex w-fit origin-top-right scale-[0.72] items-center gap-1.5 rounded-sm border border-accent/50 bg-accent px-2.5 py-1.5 text-ink no-underline shadow-[0_8px_24px_rgba(255,189,89,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-deep hover:no-underline hover:shadow-[0_12px_28px_rgba(255,189,89,0.45)] sm:right-6 sm:top-6 sm:scale-100 sm:gap-3 sm:px-4 sm:py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-accent sm:h-8 sm:w-8">
                <svg
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </span>
              <span className="flex flex-col leading-tight text-left">
                <span className="font-display text-[0.78rem] tracking-[0.12em] sm:text-[0.95rem]">
                  S&apos;abonner au Rempart+
                </span>
                <span className="text-[0.62rem] text-ink/75 sm:text-xs">
                  4,90&nbsp;€ / mois
                </span>
              </span>
            </Link>

            <Link
              href="/"
              className="no-underline hover:no-underline"
              aria-label="Le Rempart"
            >
              <Image
                src="/logo.png"
                alt="Le Rempart"
                width={420}
                height={160}
                priority
                className="mx-auto h-auto w-[130px] sm:w-[180px] md:w-[215px]"
              />
            </Link>
            <div className="animate-line-grow mx-auto mt-5 h-[3px] w-28 bg-accent" />
            <p className="font-tagline mx-auto mt-5 max-w-xl text-[0.8rem] text-white sm:text-[0.925rem]">
              Le média de droite radicale
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
