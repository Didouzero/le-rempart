import Image from "next/image";
import Link from "next/link";
import { LoginCircleIcon } from "@/components/BrandIcons";
import { SiteNav } from "@/components/SiteNav";

type HeaderProps = {
  compact?: boolean;
  isPlus?: boolean;
};

export function Header({ compact = false, isPlus = false }: HeaderProps) {
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
            <div className="animate-fade-in relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-9 pt-28 text-center sm:px-6 sm:pb-12 sm:pt-14">
            <div className="absolute right-2 top-2 z-10 flex w-[min(100%,11.5rem)] origin-top-right scale-[0.78] flex-col items-stretch gap-1.5 sm:right-6 sm:top-6 sm:w-[13.5rem] sm:scale-100">
              <Link
                href="/s-abonner"
                className="group inline-flex w-full items-center gap-2 rounded-sm border border-accent/50 bg-accent px-3 py-2 text-ink no-underline shadow-[0_8px_24px_rgba(255,189,89,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-deep hover:no-underline hover:shadow-[0_12px_28px_rgba(255,189,89,0.45)] sm:gap-3 sm:px-4 sm:py-2.5"
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
                <span className="flex flex-col leading-none text-left">
                  <span className="font-display text-[0.95rem] tracking-[0.14em] sm:text-[1.15rem]">
                    S&apos;abonner
                  </span>
                  <span className="font-display mt-0.5 text-[0.95rem] tracking-[0.14em] sm:text-[1.15rem]">
                    au Rempart+
                  </span>
                </span>
              </Link>
              {isPlus ? null : (
                <Link
                  href="/connexion"
                  className="group inline-flex w-full items-center gap-2 rounded-sm border border-accent/50 bg-ink px-3 py-2 text-accent no-underline shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:text-ink hover:no-underline sm:gap-3 sm:px-4 sm:py-2.5"
                >
                  <LoginCircleIcon className="h-7 w-7 group-hover:bg-ink group-hover:text-accent sm:h-8 sm:w-8" />
                  <span className="flex flex-col leading-none text-left">
                    <span className="font-display text-[0.95rem] tracking-[0.14em] sm:text-[1.15rem]">
                      Se connecter
                    </span>
                    <span className="mt-0.5 text-[0.65rem] tracking-[0.08em] text-white/65 group-hover:text-ink/70 sm:text-xs">
                      Déjà abonné
                    </span>
                  </span>
                </Link>
              )}
            </div>

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
