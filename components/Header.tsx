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
              className="absolute right-4 top-4 z-10 inline-flex max-w-[9.5rem] flex-col items-center border border-accent/70 bg-accent px-3 py-2.5 text-ink no-underline shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:bg-accent-deep hover:no-underline sm:right-6 sm:top-6 sm:max-w-[11rem] sm:px-4 sm:py-3"
            >
              <span className="font-display text-[0.72rem] tracking-[0.14em] sm:text-[0.8rem]">
                Nous soutenir
              </span>
              <span className="mt-1 text-[0.65rem] leading-snug text-ink/80 sm:text-xs">
                Faire un don
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
