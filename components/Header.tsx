import Image from "next/image";
import Link from "next/link";

type HeaderProps = {
  compact?: boolean;
};

const navLinkClass =
  "font-display text-[0.85rem] tracking-[0.12em] text-white/90 no-underline transition-colors hover:text-accent hover:no-underline sm:text-[0.9rem]";

export function Header({ compact = false }: HeaderProps) {
  return (
    <header className="marble-band text-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <nav
          className="flex flex-wrap items-center gap-4 sm:gap-6"
          aria-label="Navigation principale"
        >
          <Link href="/" className={navLinkClass}>
            Actualités
          </Link>
          <Link href="/contact" className={navLinkClass}>
            Nous contacter
          </Link>
          <Link href="/nous-soutenir" className={navLinkClass}>
            Nous soutenir
          </Link>
        </nav>
        <span className="hidden items-center gap-2 sm:inline-flex">
          <span className="live-dot" aria-hidden />
          <span className="font-display text-[0.8rem] tracking-[0.18em] text-accent">
            En direct
          </span>
        </span>
      </div>

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
          <div className="animate-fade-in mx-auto flex max-w-6xl flex-col items-center px-4 py-9 text-center sm:px-6 sm:py-12">
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
