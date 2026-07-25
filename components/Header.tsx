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
          className="font-display text-lg tracking-[0.12em] text-white no-underline hover:text-accent hover:no-underline sm:text-xl"
          aria-label="Le Rempart — Accueil"
        >
          Actualités
        </Link>
        <nav className="flex items-center gap-4 text-sm tracking-wide text-white/80 sm:gap-6">
          <span className="hidden items-center gap-2 sm:inline-flex">
            <span className="live-dot" aria-hidden />
            <span className="font-display text-[0.8rem] tracking-[0.18em] text-accent">
              En direct
            </span>
          </span>
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
          <div className="animate-fade-in mx-auto flex max-w-6xl flex-col items-center px-4 py-9 text-center sm:px-6 sm:py-12">
            <Link href="/" className="no-underline hover:no-underline" aria-label="Le Rempart">
              <Image
                src="/logo.png"
                alt="Le Rempart"
                width={420}
                height={160}
                priority
                className="mx-auto h-auto w-[220px] sm:w-[300px] md:w-[360px]"
              />
            </Link>
            <div className="animate-line-grow mx-auto mt-5 h-[3px] w-28 bg-accent" />
            <p className="font-tagline mx-auto mt-5 max-w-xl text-sm text-accent sm:text-base">
              Le média de droite radicale
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
