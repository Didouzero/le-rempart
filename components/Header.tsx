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
          <span>Actualité de droite</span>
          <span>Le Rempart — Le média de droite radicale</span>
          <span>Actualité de droite</span>
          <span>Le Rempart — Le média de droite radicale</span>
          <span>Actualité de droite</span>
          <span>Le Rempart — Le média de droite radicale</span>
          <span>Actualité de droite</span>
        </div>
      </div>

      {!compact && (
        <div className="border-t border-white/10">
          <div className="animate-fade-in relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-9 pt-16 text-center sm:px-6 sm:pb-12 sm:pt-14">
            <Link
              href="/nous-soutenir"
              className="group absolute right-2 top-2 z-10 inline-flex w-fit origin-top-right scale-[0.6] items-center gap-1.5 rounded-sm border border-accent/50 bg-accent px-2.5 py-1.5 text-ink no-underline shadow-[0_8px_24px_rgba(255,189,89,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-deep hover:no-underline hover:shadow-[0_12px_28px_rgba(255,189,89,0.45)] sm:right-6 sm:top-6 sm:scale-100 sm:gap-3 sm:px-4 sm:py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-accent sm:h-8 sm:w-8">
                <svg
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </span>
              <span className="flex flex-col leading-tight text-left">
                <span className="font-display text-[0.78rem] tracking-[0.12em] sm:text-[0.95rem]">
                  Nous soutenir
                </span>
                <span className="text-[0.62rem] text-ink/75 sm:text-xs">
                  Aidez Le Rempart
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
