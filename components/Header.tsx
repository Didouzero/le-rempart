import Image from "next/image";
import Link from "next/link";

type HeaderProps = {
  compact?: boolean;
};

export function Header({ compact = false }: HeaderProps) {
  return (
    <header className="marble-band text-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="no-underline hover:no-underline"
          aria-label="Le Rempart — Accueil"
        >
          <Image
            src="/logo.png"
            alt="Le Rempart"
            width={280}
            height={108}
            priority
            className="h-auto w-[150px] sm:w-[190px] md:w-[220px]"
          />
        </Link>
        <nav className="flex items-center gap-4 text-sm tracking-wide text-white/80 sm:gap-6">
          <span className="hidden items-center gap-2 sm:inline-flex">
            <span className="live-dot" aria-hidden />
            <span className="font-display text-[0.8rem] tracking-[0.18em] text-accent">
              En direct
            </span>
          </span>
          <Link
            href="/"
            className="font-display text-[0.9rem] tracking-[0.14em] text-white/90 no-underline hover:text-accent hover:no-underline"
          >
            Actualités
          </Link>
        </nav>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-80" />

      <div className="ticker" aria-label="Devise du média">
        <div className="ticker-track">
          <span>Le Rempart — Le média de droite radicale</span>
          <span>Actualité sans filtre</span>
          <span>Le Rempart — Le média de droite radicale</span>
          <span>Actualité sans filtre</span>
          <span>Le Rempart — Le média de droite radicale</span>
          <span>Actualité sans filtre</span>
          <span>Le Rempart — Le média de droite radicale</span>
          <span>Actualité sans filtre</span>
        </div>
      </div>

      {!compact && (
        <div className="border-t border-white/10">
          <div className="animate-fade-in mx-auto max-w-6xl px-4 py-9 text-center sm:px-6 sm:py-12">
            <p className="font-display text-4xl tracking-[0.14em] text-white sm:text-6xl md:text-7xl">
              Le Rempart
            </p>
            <div className="animate-line-grow mx-auto mt-4 h-[3px] w-28 bg-accent" />
            <p className="mx-auto mt-4 max-w-xl font-display text-lg tracking-[0.12em] text-accent sm:text-xl">
              Le média de droite radicale
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
